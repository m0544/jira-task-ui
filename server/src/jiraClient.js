const REQUIRED_HEADERS = ["x-jira-base-url", "x-jira-email", "x-jira-token"];

function getHeader(req, name) {
  const raw = req.headers[name];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw || "";
}

function hasHeader(req, name) {
  return Object.prototype.hasOwnProperty.call(req.headers, name);
}

function normalizeBaseUrl(baseUrl) {
  const raw = `${baseUrl || ""}`.trim();
  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsedUrl;
  try {
    parsedUrl = new URL(withProtocol);
  } catch {
    const error = new Error(
      "Invalid Jira URL. Use format: https://your-company.atlassian.net"
    );
    error.status = 400;
    throw error;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    const error = new Error(
      "Invalid Jira URL protocol. Use http:// or https://"
    );
    error.status = 400;
    throw error;
  }

  return `${parsedUrl.protocol}//${parsedUrl.host}`.replace(/\/+$/, "");
}

function resolveJiraConfig(req) {
  const hasAnyCredentialHeader = REQUIRED_HEADERS.some((headerName) =>
    hasHeader(req, headerName)
  );

  const baseUrl = hasAnyCredentialHeader
    ? getHeader(req, "x-jira-base-url")
    : process.env.JIRA_BASE_URL || "";
  const email = hasAnyCredentialHeader
    ? getHeader(req, "x-jira-email")
    : process.env.JIRA_EMAIL || "";
  const token = hasAnyCredentialHeader
    ? getHeader(req, "x-jira-token")
    : process.env.JIRA_API_TOKEN || "";

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const missing = [];
  if (!normalizedBaseUrl) {
    missing.push(REQUIRED_HEADERS[0]);
  }
  if (!email) {
    missing.push(REQUIRED_HEADERS[1]);
  }
  if (!token) {
    missing.push(REQUIRED_HEADERS[2]);
  }

  if (missing.length > 0) {
    const error = new Error(
      `Missing Jira credentials. Required headers: ${REQUIRED_HEADERS.join(
        ", "
      )}.`
    );
    error.status = 400;
    error.details = {
      missingHeaders: missing,
      hint:
        "Pass all Jira headers from UI. ENV fallback is used only when request headers are not provided.",
    };
    throw error;
  }

  return {
    baseUrl: normalizedBaseUrl,
    email: email.trim(),
    token: token.trim(),
  };
}

function textToAdf(text) {
  const lines = `${text || ""}`.replace(/\r/g, "").split("\n");
  const content = lines.map((line) => {
    if (line.length === 0) {
      return { type: "paragraph", content: [] };
    }
    return {
      type: "paragraph",
      content: [{ type: "text", text: line }],
    };
  });

  return {
    type: "doc",
    version: 1,
    content: content.length > 0 ? content : [{ type: "paragraph", content: [] }],
  };
}

function extractJiraErrorMessage(parsedBody) {
  if (!parsedBody) return "";
  if (typeof parsedBody === "string") return parsedBody.trim();
  if (typeof parsedBody !== "object") return "";

  const parts = [];
  if (typeof parsedBody.message === "string" && parsedBody.message.trim()) {
    parts.push(parsedBody.message.trim());
  }
  if (Array.isArray(parsedBody.errorMessages)) {
    const messages = parsedBody.errorMessages
      .filter((item) => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
    if (messages.length > 0) {
      parts.push(messages.join(" | "));
    }
  }
  if (parsedBody.errors && typeof parsedBody.errors === "object") {
    const fieldErrors = Object.entries(parsedBody.errors)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" | ");
    if (fieldErrors) {
      parts.push(fieldErrors);
    }
  }
  return parts.join(" - ");
}

async function jiraRequest(config, path, options = {}) {
  const url = `${config.baseUrl}${path}`;
  const method = options.method || "GET";
  const headers = {
    Accept: "application/json",
    Authorization: `Basic ${Buffer.from(`${config.email}:${config.token}`).toString(
      "base64"
    )}`,
    ...options.headers,
  };

  const init = { method, headers };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, init);
  const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
  const responseText = await response.text();
  let parsedBody;
  try {
    parsedBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    parsedBody = responseText;
  }

  if (!response.ok) {
    const jiraMessage = extractJiraErrorMessage(parsedBody);
    const error = new Error(
      jiraMessage
        ? `Jira API error ${response.status} for ${method} ${path} - ${jiraMessage}`
        : `Jira API error ${response.status} for ${method} ${path}`
    );
    error.status = response.status;
    error.details = parsedBody;
    throw error;
  }

  if (responseText && typeof parsedBody === "string") {
    const preview = parsedBody.slice(0, 180);
    const looksLikeHtml = /^\s*</.test(parsedBody);
    const error = new Error(
      looksLikeHtml
        ? `Unexpected HTML response from Jira for ${method} ${path}. Verify Jira URL is exactly https://<your-site>.atlassian.net`
        : `Unexpected non-JSON response from Jira for ${method} ${path}`
    );
    error.status = 502;
    error.details = {
      contentType,
      preview,
    };
    throw error;
  }

  return parsedBody;
}

module.exports = {
  resolveJiraConfig,
  jiraRequest,
  textToAdf,
};
