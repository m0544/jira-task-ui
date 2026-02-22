require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { jiraRequest, resolveJiraConfig, textToAdf } = require("./jiraClient");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const DEFAULT_DEV_ORIGIN_PATTERNS = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

function getConfiguredOrigins() {
  return `${process.env.CLIENT_ORIGIN || ""}`
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const configuredOrigins = getConfiguredOrigins();

function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }
  if (configuredOrigins.length > 0) {
    return configuredOrigins.includes(origin);
  }
  return DEFAULT_DEV_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function getRequestConfig(req) {
  return resolveJiraConfig(req);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "jira-task-ui-server" });
});

app.post(
  "/api/jira/test-connection",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const me = await jiraRequest(config, "/rest/api/3/myself");
    if (!me || typeof me !== "object" || !me.accountId) {
      const error = new Error("Unexpected Jira connection response");
      error.status = 502;
      error.details = me;
      throw error;
    }
    res.json({
      ok: true,
      accountId: me.accountId,
      displayName: me.displayName,
      emailAddress: me.emailAddress || null,
    });
  })
);

app.get(
  "/api/jira/priorities",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const result = await jiraRequest(config, "/rest/api/3/priority/search");
    res.json(result.values || []);
  })
);

app.get(
  "/api/jira/issue-types",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const projectKey = `${req.query.projectKey || ""}`.trim();
    if (projectKey) {
      const project = await jiraRequest(
        config,
        `/rest/api/3/project/${encodeURIComponent(projectKey)}`
      );
      res.json(project.issueTypes || []);
      return;
    }
    const result = await jiraRequest(config, "/rest/api/3/issuetype");
    res.json(result || []);
  })
);

app.get(
  "/api/jira/users/search",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const query = `${req.query.query || ""}`.trim();
    if (!query) {
      res.status(400).json({ message: "query is required" });
      return;
    }
    const result = await jiraRequest(
      config,
      `/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=20`
    );
    res.json(result || []);
  })
);

app.get(
  "/api/jira/issues",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const jql = `${req.query.jql || "ORDER BY updated DESC"}`.trim();
    const maxResultsRaw = Number(req.query.maxResults || 25);
    const startAtRaw = Number(req.query.startAt || 0);
    const maxResults = Number.isFinite(maxResultsRaw)
      ? Math.min(Math.max(maxResultsRaw, 1), 100)
      : 25;
    const startAt = Number.isFinite(startAtRaw) ? Math.max(startAtRaw, 0) : 0;

    const fields = ["summary", "status", "priority", "assignee", "updated", "issuetype"];

    // Jira Cloud: POST /rest/api/3/search/jql — body must NOT include startAt (use nextPageToken for pagination).
    const result = await jiraRequest(config, "/rest/api/3/search/jql", {
      method: "POST",
      body: {
        jql,
        maxResults,
        fields,
        fieldsByKeys: false,
      },
    });

    if (!result || typeof result !== "object" || !Array.isArray(result.issues)) {
      const error = new Error("Unexpected Jira search response");
      error.status = 502;
      error.details = result;
      throw error;
    }

    const resultStartAt = Number.isFinite(result.startAt) ? result.startAt : startAt;
    res.json({
      startAt: resultStartAt,
      maxResults: Number.isFinite(result.maxResults)
        ? Number(result.maxResults)
        : maxResults,
      total: Number.isFinite(result.total) ? Number(result.total) : result.issues.length,
      nextPageToken: typeof result.nextPageToken === "string" ? result.nextPageToken : null,
      issues: result.issues || [],
    });
  })
);

app.get(
  "/api/jira/issues/:issueKey",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const issueKey = req.params.issueKey;
    const issue = await jiraRequest(
      config,
      `/rest/api/3/issue/${encodeURIComponent(
        issueKey
      )}?fields=summary,description,status,priority,assignee,issuetype,project,updated,created,reporter`
    );
    res.json(issue);
  })
);

app.post(
  "/api/jira/issues",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const {
      projectKey,
      summary,
      description,
      issueTypeId,
      issueTypeName = "Task",
      priorityId,
      assigneeAccountId,
    } = req.body || {};

    if (!projectKey || !summary) {
      res.status(400).json({ message: "projectKey and summary are required" });
      return;
    }

    const fields = {
      project: { key: `${projectKey}`.trim() },
      summary: `${summary}`.trim(),
      issuetype: issueTypeId
        ? { id: `${issueTypeId}`.trim() }
        : { name: `${issueTypeName}`.trim() || "Task" },
    };

    if (description !== undefined) {
      fields.description = textToAdf(description);
    }
    if (typeof priorityId === "string" && priorityId.trim()) {
      fields.priority = { id: `${priorityId}`.trim() };
    }
    if (typeof assigneeAccountId === "string" && assigneeAccountId.trim()) {
      fields.assignee = { accountId: `${assigneeAccountId}`.trim() };
    }

    const created = await jiraRequest(config, "/rest/api/3/issue", {
      method: "POST",
      body: { fields },
    });

    const issue = await jiraRequest(
      config,
      `/rest/api/3/issue/${encodeURIComponent(created.key)}`
    );
    res.status(201).json(issue);
  })
);

app.put(
  "/api/jira/issues/:issueKey",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const issueKey = req.params.issueKey;
    const payload = req.body || {};
    const nextFields = {};

    if (payload.summary !== undefined) {
      nextFields.summary = `${payload.summary}`;
    }
    if (payload.description !== undefined) {
      nextFields.description = textToAdf(payload.description);
    }
    if (payload.priorityId !== undefined) {
      nextFields.priority = payload.priorityId ? { id: `${payload.priorityId}` } : null;
    }
    if (payload.assigneeAccountId !== undefined) {
      nextFields.assignee = payload.assigneeAccountId
        ? { accountId: `${payload.assigneeAccountId}`.trim() }
        : null;
    }

    if (Object.keys(nextFields).length === 0) {
      res.status(400).json({ message: "No fields provided for update" });
      return;
    }

    await jiraRequest(config, `/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
      method: "PUT",
      body: { fields: nextFields },
    });

    const issue = await jiraRequest(
      config,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}`
    );
    res.json(issue);
  })
);

app.get(
  "/api/jira/issues/:issueKey/comments",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const issueKey = req.params.issueKey;
    const result = await jiraRequest(
      config,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment?orderBy=-created`
    );
    res.json(result.comments || []);
  })
);

app.post(
  "/api/jira/issues/:issueKey/comments",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const issueKey = req.params.issueKey;
    const text = `${req.body?.text || ""}`.trim();
    if (!text) {
      res.status(400).json({ message: "text is required" });
      return;
    }
    const created = await jiraRequest(
      config,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
      {
        method: "POST",
        body: {
          body: textToAdf(text),
        },
      }
    );
    res.status(201).json(created);
  })
);

app.put(
  "/api/jira/issues/:issueKey/comments/:commentId",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const issueKey = req.params.issueKey;
    const commentId = req.params.commentId;
    const text = `${req.body?.text || ""}`.trim();
    if (!text) {
      res.status(400).json({ message: "text is required" });
      return;
    }
    const updated = await jiraRequest(
      config,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(
        commentId
      )}`,
      {
        method: "PUT",
        body: {
          body: textToAdf(text),
        },
      }
    );
    res.json(updated);
  })
);

app.get(
  "/api/jira/issues/:issueKey/transitions",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const issueKey = req.params.issueKey;
    const result = await jiraRequest(
      config,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`
    );
    res.json(result.transitions || []);
  })
);

app.post(
  "/api/jira/issues/:issueKey/transitions",
  asyncHandler(async (req, res) => {
    const config = getRequestConfig(req);
    const issueKey = req.params.issueKey;
    const transitionId = `${req.body?.transitionId || ""}`.trim();
    const comment = `${req.body?.comment || ""}`.trim();
    if (!transitionId) {
      res.status(400).json({ message: "transitionId is required" });
      return;
    }

    const body = {
      transition: { id: transitionId },
    };

    if (comment) {
      body.update = {
        comment: [
          {
            add: {
              body: textToAdf(comment),
            },
          },
        ],
      };
    }

    await jiraRequest(
      config,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
      {
        method: "POST",
        body,
      }
    );

    const issue = await jiraRequest(
      config,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}`
    );
    res.json(issue);
  })
);

app.use((error, _req, res, _next) => {
  const status = Number(error.status || 500);
  res.status(status).json({
    message: error.message || "Unexpected server error",
    details: error.details || null,
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Jira task UI server is running on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log("Issue search: using POST /rest/api/3/search/jql (Jira Cloud migration from deprecated GET /search)");
});
