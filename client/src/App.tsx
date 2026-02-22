import { useEffect, useMemo, useState } from "react";

type Language = "he" | "en";

type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  defaultProjectKey: string;
  jql: string;
  maxResults: number;
};

type JiraIssue = {
  id: string;
  key: string;
  fields: {
    summary?: string;
    status?: { name?: string };
    priority?: { id?: string; name?: string };
    assignee?: { accountId?: string; displayName?: string };
    issuetype?: { name?: string };
    description?: unknown;
    created?: string;
    updated?: string;
  };
};

type JiraComment = {
  id: string;
  author?: { displayName?: string };
  body?: unknown;
  created?: string;
  updated?: string;
};

type JiraTransition = {
  id: string;
  name: string;
  to?: { name?: string };
};

type JiraPriority = {
  id: string;
  name: string;
};

type JiraIssueType = {
  id: string;
  name: string;
};

type JiraUser = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
};

type EditForm = {
  summary: string;
  description: string;
  priorityId: string;
  assigneeAccountId: string;
};

type CreateForm = {
  projectKey: string;
  issueTypeId: string;
  issueTypeName: string;
  summary: string;
  description: string;
  priorityId: string;
  assigneeAccountId: string;
};

const API_BASE_URL = "http://localhost:4000";
const STORAGE_KEY = "jira-task-ui-config-v1";
const STORAGE_LANG_KEY = "jira-task-ui-lang-v1";

const defaultConfig: JiraConfig = {
  baseUrl: "",
  email: "",
  apiToken: "",
  defaultProjectKey: "",
  jql: "assignee = currentUser() ORDER BY updated DESC",
  maxResults: 25,
};

const textMap = {
  he: {
    title: "עוזר Jira חכם",
    subtitle: "אגף השיקום - ניתוח משימות ויצירת User Stories",
    jiraSettings: "הגדרות Jira",
    noTasksYet: "עדיין אין משימות",
    startConversation: "התחל שיחה עם ה-AI ליצירת משימות",
    welcomeTitle: "שלום! אני עוזר Jira חכם",
    welcomeDesc: "תארו לי משימה בצורה חופשית, ואני אהפוך אותה ל-User Story מקצועי",
    writeTask: "כתבו משימה: תארו מה צריך לעשות בשפה טבעית",
    receiveStory: "קבלו User Story: כולל Story Points, צוות, ועדיפות",
    quickTemplates: "תבניות מהירות:",
    templateNewFeature: "פיצ'ר חדש",
    templateUX: "שיפור UX",
    templateBug: "תיקון באג",
    templateContent: "תוכן",
    templateCheckValue: "לבדוק ערך",
    templateBreakDown: "פרק משימה גדולה",
    describePlaceholder: "תאר את המשימה שלך... (או השתמש בתבניות למעלה)",
    langLabel: "שפה",
    settings: "הגדרות חיבור",
    jiraUrl: "Jira URL",
    jiraEmail: "אימייל Jira",
    jiraToken: "API Token",
    projectKey: "Project Key ברירת מחדל",
    jql: "JQL לחיפוש",
    maxResults: "כמות מקסימלית לתוצאות",
    saveLocal: "שמור הגדרות מקומית",
    testConnection: "בדוק חיבור",
    loadMetadata: "טען נתוני שדות",
    loadIssues: "טען משימות",
    connectedAs: "מחובר כ:",
    issuesList: "רשימת משימות",
    refresh: "רענן",
    noIssues: "אין משימות להצגה כרגע.",
    noIssuesTip: "ייתכן שה-JQL מחזיר 0 תוצאות. אפשר לנסות שאילתה רחבה יותר.",
    currentJql: "JQL נוכחי",
    tryBroaderSearch: "נסה שאילתה רחבה",
    broadSearchLoaded: "בוצע ניסיון טעינה עם שאילתה רחבה יותר.",
    issueDetails: "פרטי משימה",
    chooseIssue: "בחר משימה מהרשימה כדי לראות פרטים.",
    summary: "Summary",
    description: "Description",
    priority: "Priority",
    assigneeId: "Assignee Account ID",
    searchUser: "חיפוש משתמש להקצאה",
    userQuery: "שם/אימייל לחיפוש",
    find: "חפש",
    noUsersFound: "לא נמצאו משתמשים",
    saveChanges: "שמור שינויים במשימה",
    comments: "תגובות",
    newComment: "תגובה חדשה",
    addComment: "הוסף תגובה",
    editComment: "ערוך תגובה",
    saveComment: "שמור תגובה",
    transitions: "שינוי סטטוס",
    transitionTo: "מעבר לסטטוס",
    transitionComment: "תגובה אופציונלית למעבר",
    executeTransition: "בצע מעבר",
    createIssue: "יצירת משימה חדשה",
    issueType: "Issue Type",
    create: "צור משימה",
    created: "נוצר בתאריך",
    updated: "עודכן בתאריך",
    status: "סטטוס",
    type: "סוג",
    assignee: "משויך ל",
    unassigned: "לא משויך",
    selectIssue: "בחר משימה",
    emptySummaryError: "חובה למלא Summary.",
    emptyProjectError: "חובה למלא Project Key.",
    missingConfigError:
      "חסרות הגדרות חיבור. מלא Jira URL, אימייל ו-API Token ואז נסה שוב.",
    savedSettings: "ההגדרות נשמרו מקומית.",
    metadataLoaded: "נתוני השדות נטענו בהצלחה.",
    connectionSucceeded: "החיבור הצליח.",
    issuesLoaded: "המשימות נטענו בהצלחה.",
    noIssuesLoaded: "לא נמצאו משימות לשאילתה הנוכחית.",
    issueUpdated: "המשימה עודכנה בהצלחה.",
    commentAdded: "התגובה נוספה בהצלחה.",
    commentUpdated: "התגובה עודכנה בהצלחה.",
    transitionDone: "המעבר בוצע בהצלחה.",
    issueCreated: "המשימה נוצרה בהצלחה:",
    requestFailed: "הבקשה נכשלה.",
  },
  en: {
    title: "Smart Jira Assistant",
    subtitle: "Rehabilitation Dept - Task analysis and User Story creation",
    jiraSettings: "Jira Settings",
    noTasksYet: "No tasks yet",
    startConversation: "Start a conversation with the AI to create tasks",
    welcomeTitle: "Hello! I am Smart Jira Assistant",
    welcomeDesc: "Describe a task freely, and I will turn it into a professional User Story",
    writeTask: "Write a task: Describe what needs to be done in natural language",
    receiveStory: "Receive a User Story: includes Story Points, team, and priority",
    quickTemplates: "Quick Templates:",
    templateNewFeature: "New Feature",
    templateUX: "UX Improvement",
    templateBug: "Bug Fix",
    templateContent: "Content",
    templateCheckValue: "Check Value",
    templateBreakDown: "Break Down Large Task",
    describePlaceholder: "Describe your task... (or use the templates above)",
    langLabel: "Language",
    settings: "Connection Settings",
    jiraUrl: "Jira URL",
    jiraEmail: "Jira Email",
    jiraToken: "API Token",
    projectKey: "Default Project Key",
    jql: "Search JQL",
    maxResults: "Max Results",
    saveLocal: "Save Local Settings",
    testConnection: "Test Connection",
    loadMetadata: "Load Field Metadata",
    loadIssues: "Load Issues",
    connectedAs: "Connected as:",
    issuesList: "Issues",
    refresh: "Refresh",
    noIssues: "No issues to display.",
    noIssuesTip: "Your JQL may return 0 results. Try a broader query.",
    currentJql: "Current JQL",
    tryBroaderSearch: "Try broader query",
    broadSearchLoaded: "Tried loading with a broader query.",
    issueDetails: "Issue Details",
    chooseIssue: "Select an issue from the list to view details.",
    summary: "Summary",
    description: "Description",
    priority: "Priority",
    assigneeId: "Assignee Account ID",
    searchUser: "Search Assignable User",
    userQuery: "Name/email query",
    find: "Search",
    noUsersFound: "No users found",
    saveChanges: "Save Issue Changes",
    comments: "Comments",
    newComment: "New Comment",
    addComment: "Add Comment",
    editComment: "Edit Comment",
    saveComment: "Save Comment",
    transitions: "Transitions",
    transitionTo: "Transition To",
    transitionComment: "Optional transition comment",
    executeTransition: "Execute Transition",
    createIssue: "Create New Issue",
    issueType: "Issue Type",
    create: "Create Issue",
    created: "Created",
    updated: "Updated",
    status: "Status",
    type: "Type",
    assignee: "Assignee",
    unassigned: "Unassigned",
    selectIssue: "Select issue",
    emptySummaryError: "Summary is required.",
    emptyProjectError: "Project Key is required.",
    missingConfigError:
      "Missing connection settings. Fill Jira URL, email, and API Token and try again.",
    savedSettings: "Settings saved locally.",
    metadataLoaded: "Metadata loaded successfully.",
    connectionSucceeded: "Connection succeeded.",
    issuesLoaded: "Issues loaded successfully.",
    noIssuesLoaded: "No issues matched the current JQL query.",
    issueUpdated: "Issue updated successfully.",
    commentAdded: "Comment added successfully.",
    commentUpdated: "Comment updated successfully.",
    transitionDone: "Transition executed successfully.",
    issueCreated: "Issue created successfully:",
    requestFailed: "Request failed.",
  },
} as const;

function toText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map((item) => toText(item)).join("");
  if (typeof node === "object") {
    const current = node as { type?: string; text?: string; content?: unknown };
    if (current.type === "text") return current.text || "";
    if (current.type === "hardBreak") return "\n";
    const contentText = toText(current.content);
    if (current.type === "paragraph") return `${contentText}\n`;
    return contentText;
  }
  return "";
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return textMap.en.requestFailed;
}

function extractApiErrorMessage(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === "string") {
    const next = payload.trim();
    return next || null;
  }
  if (typeof payload !== "object") return null;

  const result: string[] = [];
  const data = payload as {
    message?: unknown;
    details?: unknown;
    errorMessages?: unknown;
    errors?: unknown;
  };

  if (typeof data.message === "string" && data.message.trim()) {
    result.push(data.message.trim());
  }
  if (Array.isArray(data.errorMessages)) {
    const list = data.errorMessages
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
    if (list.length > 0) {
      result.push(list.join(" | "));
    }
  }
  if (data.errors && typeof data.errors === "object") {
    const fields = Object.entries(data.errors as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" | ");
    if (fields) {
      result.push(fields);
    }
  }

  if (data.details) {
    const detailsText = extractApiErrorMessage(data.details);
    if (detailsText) {
      result.push(detailsText);
    }
  }

  const combined = result.filter(Boolean).join(" - ");
  return combined || null;
}

async function apiRequest<T>(
  path: string,
  config: JiraConfig,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set("x-jira-base-url", config.baseUrl.trim());
  headers.set("x-jira-email", config.email.trim());
  headers.set("x-jira-token", config.apiToken.trim());
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  const responseText = await response.text();
  let json: unknown = null;
  if (responseText) {
    try {
      json = JSON.parse(responseText);
    } catch {
      json = responseText;
    }
  }

  if (!response.ok) {
    const message = extractApiErrorMessage(json) ||
      `HTTP ${response.status} ${response.statusText || "Request failed"}`;
    throw new Error(message);
  }
  return json as T;
}

function App() {
  const [language, setLanguage] = useState<Language>("he");
  const [config, setConfig] = useState<JiraConfig>(defaultConfig);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );
  const [me, setMe] = useState<{ displayName?: string; emailAddress?: string } | null>(
    null
  );
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [selectedIssueKey, setSelectedIssueKey] = useState<string>("");
  const [issueDetails, setIssueDetails] = useState<JiraIssue | null>(null);
  const [comments, setComments] = useState<JiraComment[]>([]);
  const [transitions, setTransitions] = useState<JiraTransition[]>([]);
  const [priorities, setPriorities] = useState<JiraPriority[]>([]);
  const [issueTypes, setIssueTypes] = useState<JiraIssueType[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<JiraUser[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentText, setEditingCommentText] = useState("");
  const [transitionId, setTransitionId] = useState("");
  const [transitionComment, setTransitionComment] = useState("");
  const [editForm, setEditForm] = useState<EditForm>({
    summary: "",
    description: "",
    priorityId: "",
    assigneeAccountId: "",
  });
  const [createForm, setCreateForm] = useState<CreateForm>({
    projectKey: "",
    issueTypeId: "",
    issueTypeName: "Task",
    summary: "",
    description: "",
    priorityId: "",
    assigneeAccountId: "",
  });
  const [isBusy, setIsBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [welcomeTaskInput, setWelcomeTaskInput] = useState("");

  const t = useMemo(() => textMap[language], [language]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as JiraConfig;
        setConfig({
          ...defaultConfig,
          ...parsed,
          maxResults: Number(parsed.maxResults || defaultConfig.maxResults),
        });
        setCreateForm((prev) => ({
          ...prev,
          projectKey: parsed.defaultProjectKey || "",
        }));
      } catch {
        // ignore invalid local state
      }
    }

    const storedLang = localStorage.getItem(STORAGE_LANG_KEY);
    if (storedLang === "he" || storedLang === "en") {
      setLanguage(storedLang);
    }
  }, []);

  useEffect(() => {
    setCreateForm((prev) => ({
      ...prev,
      projectKey: prev.projectKey || config.defaultProjectKey || "",
    }));
  }, [config.defaultProjectKey]);

  function saveLocalSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    localStorage.setItem(STORAGE_LANG_KEY, language);
    setNotice({ kind: "ok", text: t.savedSettings });
  }

  function ensureConnectionInputs(): boolean {
    if (!config.baseUrl.trim() || !config.email.trim() || !config.apiToken.trim()) {
      setNotice({ kind: "error", text: t.missingConfigError });
      return false;
    }
    return true;
  }

  async function loadMetadata() {
    if (!ensureConnectionInputs()) return;
    setIsBusy(true);
    try {
      const [priorityList, issueTypeList] = await Promise.all([
        apiRequest<JiraPriority[]>("/api/jira/priorities", config),
        apiRequest<JiraIssueType[]>(
          `/api/jira/issue-types${
            config.defaultProjectKey
              ? `?projectKey=${encodeURIComponent(config.defaultProjectKey)}`
              : ""
          }`,
          config
        ),
      ]);
      setPriorities(priorityList);
      setIssueTypes(issueTypeList);
      if (issueTypeList.length > 0) {
        setCreateForm((prev) => {
          const selectedType =
            issueTypeList.find((item) => item.id === prev.issueTypeId) ||
            issueTypeList.find((item) => item.name === prev.issueTypeName) ||
            issueTypeList[0];
          return {
            ...prev,
            issueTypeId: selectedType.id,
            issueTypeName: selectedType.name,
            projectKey: prev.projectKey || config.defaultProjectKey,
          };
        });
      }
      setNotice({ kind: "ok", text: t.metadataLoaded });
    } catch (error) {
      setNotice({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function testConnection() {
    if (!ensureConnectionInputs()) return;
    setIsBusy(true);
    try {
      const result = await apiRequest<{ displayName?: string; emailAddress?: string }>(
        "/api/jira/test-connection",
        config,
        { method: "POST" }
      );
      setMe(result);
      setNotice({ kind: "ok", text: t.connectionSucceeded });
      await loadMetadata();
      await loadIssues();
    } catch (error) {
      setNotice({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function loadIssuesWithJql(jqlValueInput: string): Promise<boolean> {
    if (!ensureConnectionInputs()) return false;
    setIsBusy(true);
    try {
      const jqlValue = jqlValueInput.trim() || "ORDER BY updated DESC";
      const result = await apiRequest<{ issues: JiraIssue[] }>(
        `/api/jira/issues?jql=${encodeURIComponent(jqlValue)}&maxResults=${encodeURIComponent(
          String(config.maxResults)
        )}`,
        config
      );
      setIssues(result.issues || []);
      if (result.issues.length === 0) {
        setSelectedIssueKey("");
        setIssueDetails(null);
        setComments([]);
        setTransitions([]);
      }
      if (result.issues.length > 0 && !selectedIssueKey) {
        await loadIssueBundle(result.issues[0].key);
      }
      setNotice({
        kind: "ok",
        text:
          result.issues.length > 0
            ? `${t.issuesLoaded} (${result.issues.length})`
            : t.noIssuesLoaded,
      });
      return true;
    } catch (error) {
      setIssues([]);
      setSelectedIssueKey("");
      setIssueDetails(null);
      setComments([]);
      setTransitions([]);
      setNotice({ kind: "error", text: getErrorMessage(error) });
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function loadIssues() {
    await loadIssuesWithJql(config.jql);
  }

  function buildBroaderJql(): string {
    const defaultProject = config.defaultProjectKey.trim();
    if (defaultProject) {
      return `project = ${defaultProject} ORDER BY updated DESC`;
    }
    return "ORDER BY updated DESC";
  }

  async function tryBroaderSearch() {
    const broaderJql = buildBroaderJql();
    setConfig((prev) => ({ ...prev, jql: broaderJql }));
    const isLoaded = await loadIssuesWithJql(broaderJql);
    if (isLoaded) {
      setNotice({ kind: "ok", text: t.broadSearchLoaded });
    }
  }

  function syncEditForm(issue: JiraIssue) {
    setEditForm({
      summary: issue.fields.summary || "",
      description: toText(issue.fields.description).trim(),
      priorityId: issue.fields.priority?.id || "",
      assigneeAccountId: issue.fields.assignee?.accountId || "",
    });
  }

  async function loadIssueBundle(issueKey: string) {
    if (!ensureConnectionInputs()) return;
    setIsBusy(true);
    setSelectedIssueKey(issueKey);
    try {
      const [issue, commentList, transitionList] = await Promise.all([
        apiRequest<JiraIssue>(`/api/jira/issues/${encodeURIComponent(issueKey)}`, config),
        apiRequest<JiraComment[]>(
          `/api/jira/issues/${encodeURIComponent(issueKey)}/comments`,
          config
        ),
        apiRequest<JiraTransition[]>(
          `/api/jira/issues/${encodeURIComponent(issueKey)}/transitions`,
          config
        ),
      ]);
      setIssueDetails(issue);
      setComments(commentList || []);
      setTransitions(transitionList || []);
      setTransitionId(transitionList?.[0]?.id || "");
      syncEditForm(issue);
    } catch (error) {
      setNotice({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function saveIssueChanges() {
    if (!issueDetails) return;
    if (!editForm.summary.trim()) {
      setNotice({ kind: "error", text: t.emptySummaryError });
      return;
    }
    setIsBusy(true);
    try {
      const updated = await apiRequest<JiraIssue>(
        `/api/jira/issues/${encodeURIComponent(issueDetails.key)}`,
        config,
        {
          method: "PUT",
          body: JSON.stringify({
            summary: editForm.summary,
            description: editForm.description,
            priorityId: editForm.priorityId || null,
            assigneeAccountId: editForm.assigneeAccountId || null,
          }),
        }
      );
      setIssueDetails(updated);
      syncEditForm(updated);
      await loadIssues();
      setNotice({ kind: "ok", text: t.issueUpdated });
    } catch (error) {
      setNotice({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function createIssue() {
    if (!createForm.projectKey.trim()) {
      setNotice({ kind: "error", text: t.emptyProjectError });
      return;
    }
    if (!createForm.summary.trim()) {
      setNotice({ kind: "error", text: t.emptySummaryError });
      return;
    }
    setIsBusy(true);
    try {
      const selectedType = issueTypes.find((item) => item.id === createForm.issueTypeId);
      const created = await apiRequest<JiraIssue>("/api/jira/issues", config, {
        method: "POST",
        body: JSON.stringify({
          projectKey: createForm.projectKey.trim(),
          issueTypeId: createForm.issueTypeId || null,
          issueTypeName: selectedType?.name || createForm.issueTypeName.trim() || "Task",
          summary: createForm.summary,
          description: createForm.description,
          priorityId: createForm.priorityId || null,
          assigneeAccountId: createForm.assigneeAccountId || null,
        }),
      });
      setCreateForm((prev) => ({
        ...prev,
        summary: "",
        description: "",
      }));
      setNotice({ kind: "ok", text: `${t.issueCreated} ${created.key}` });
      await loadIssues();
      await loadIssueBundle(created.key);
    } catch (error) {
      setNotice({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function addComment() {
    if (!issueDetails) return;
    if (!newComment.trim()) return;
    setIsBusy(true);
    try {
      await apiRequest<JiraComment>(
        `/api/jira/issues/${encodeURIComponent(issueDetails.key)}/comments`,
        config,
        {
          method: "POST",
          body: JSON.stringify({ text: newComment }),
        }
      );
      setNewComment("");
      const latest = await apiRequest<JiraComment[]>(
        `/api/jira/issues/${encodeURIComponent(issueDetails.key)}/comments`,
        config
      );
      setComments(latest);
      setNotice({ kind: "ok", text: t.commentAdded });
    } catch (error) {
      setNotice({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function saveComment(commentId: string) {
    if (!issueDetails || !editingCommentText.trim()) return;
    setIsBusy(true);
    try {
      await apiRequest<JiraComment>(
        `/api/jira/issues/${encodeURIComponent(issueDetails.key)}/comments/${encodeURIComponent(
          commentId
        )}`,
        config,
        {
          method: "PUT",
          body: JSON.stringify({ text: editingCommentText }),
        }
      );
      const latest = await apiRequest<JiraComment[]>(
        `/api/jira/issues/${encodeURIComponent(issueDetails.key)}/comments`,
        config
      );
      setComments(latest);
      setEditingCommentId("");
      setEditingCommentText("");
      setNotice({ kind: "ok", text: t.commentUpdated });
    } catch (error) {
      setNotice({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function executeTransition() {
    if (!issueDetails || !transitionId) return;
    setIsBusy(true);
    try {
      const updated = await apiRequest<JiraIssue>(
        `/api/jira/issues/${encodeURIComponent(issueDetails.key)}/transitions`,
        config,
        {
          method: "POST",
          body: JSON.stringify({
            transitionId,
            comment: transitionComment,
          }),
        }
      );
      setIssueDetails(updated);
      setTransitionComment("");
      await loadIssueBundle(issueDetails.key);
      await loadIssues();
      setNotice({ kind: "ok", text: t.transitionDone });
    } catch (error) {
      setNotice({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function searchUsers() {
    if (!userQuery.trim()) {
      setUserResults([]);
      return;
    }
    setIsBusy(true);
    try {
      const result = await apiRequest<JiraUser[]>(
        `/api/jira/users/search?query=${encodeURIComponent(userQuery)}`,
        config
      );
      setUserResults(result || []);
    } catch (error) {
      setNotice({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  function applyQuickTemplate(typeKey: string) {
    const nameMap: Record<string, string> = {
      feature: "Feature",
      ux: "Story",
      bug: "Bug",
      content: "Task",
      value: "Task",
      breakdown: "Task",
    };
    const name = nameMap[typeKey] || "Task";
    const found = issueTypes.find(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    );
    setCreateForm((prev) => ({
      ...prev,
      issueTypeId: found?.id || prev.issueTypeId,
      issueTypeName: found?.name || name,
    }));
  }

  function submitWelcomeTask() {
    const text = welcomeTaskInput.trim();
    if (!text) return;
    setCreateForm((prev) => ({
      ...prev,
      summary: text,
      description: prev.description || text,
    }));
    setWelcomeTaskInput("");
  }

  return (
    <div className={`app app-smart ${language === "he" ? "rtl" : ""}`}>
      <header className="top-bar">
        <button
          type="button"
          className="btn-settings"
          onClick={() => setShowSettings((v) => !v)}
          aria-label={t.jiraSettings}
        >
          <span className="icon-gear" aria-hidden>⚙</span>
          <span>{t.jiraSettings}</span>
        </button>
        <div className="brand">
          <h1 className="brand-title">{t.title}</h1>
          <p className="brand-subtitle">{t.subtitle}</p>
        </div>
        <div className="header-end">
          <span className="icon-star" aria-hidden>✦</span>
          <div className="lang-switch" role="group" aria-label={t.langLabel}>
            <button
              className={`lang-btn ${language === "he" ? "active" : ""}`}
              onClick={() => setLanguage("he")}
              type="button"
            >
              עברית
            </button>
            <button
              className={`lang-btn ${language === "en" ? "active" : ""}`}
              onClick={() => setLanguage("en")}
              type="button"
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <section className="card settings section settings-panel">
          <h2>{t.settings}</h2>
          <div className="grid grid-3">
            <label>
              <span>{t.jiraUrl}</span>
              <input
                value={config.baseUrl}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, baseUrl: event.target.value }))
                }
                placeholder="https://your-domain.atlassian.net"
              />
            </label>
            <label>
              <span>{t.jiraEmail}</span>
              <input
                value={config.email}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="you@example.com"
              />
            </label>
            <label>
              <span>{t.jiraToken}</span>
              <input
                type="password"
                value={config.apiToken}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, apiToken: event.target.value }))
                }
                placeholder="ATATT..."
              />
            </label>
            <label>
              <span>{t.projectKey}</span>
              <input
                value={config.defaultProjectKey}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    defaultProjectKey: event.target.value,
                  }))
                }
                placeholder="PROJ"
              />
            </label>
            <label>
              <span>{t.maxResults}</span>
              <input
                type="number"
                min={1}
                max={100}
                value={config.maxResults}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxResults: Number(event.target.value || 25),
                  }))
                }
              />
            </label>
            <label className="span-3">
              <span>{t.jql}</span>
              <input
                value={config.jql}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, jql: event.target.value }))
                }
                placeholder="assignee = currentUser() ORDER BY updated DESC"
              />
            </label>
          </div>
          <div className="actions">
            <button className="btn btn-ghost" onClick={saveLocalSettings} type="button">
              {t.saveLocal}
            </button>
            <button className="btn btn-primary" onClick={testConnection} type="button" disabled={isBusy}>
              {t.testConnection}
            </button>
            <button className="btn btn-soft" onClick={loadMetadata} type="button" disabled={isBusy}>
              {t.loadMetadata}
            </button>
            <button className="btn btn-primary" onClick={loadIssues} type="button" disabled={isBusy}>
              {t.loadIssues}
            </button>
          </div>
          {me && (
            <p className="connected">
              {t.connectedAs} {me.displayName} {me.emailAddress ? `(${me.emailAddress})` : ""}
            </p>
          )}
        </section>
      )}

      {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

      <div className="main-grid">
        <aside className="sidebar card">
          {issues.length === 0 ? (
            <div className="sidebar-empty">
              <p className="sidebar-empty-title">{t.noTasksYet}</p>
              <p className="sidebar-empty-tip">{t.startConversation}</p>
            </div>
          ) : (
            <>
              <div className="row between sidebar-header">
                <h2>{t.issuesList}</h2>
                <button className="btn btn-soft btn-sm" onClick={loadIssues} type="button" disabled={isBusy}>
                  {t.refresh}
                </button>
              </div>
              <div className="issues-list">
                {issues.map((issue) => (
                  <button
                    className={`issue-item ${selectedIssueKey === issue.key ? "active" : ""}`}
                    key={issue.id}
                    onClick={() => loadIssueBundle(issue.key)}
                    type="button"
                  >
                    <strong>{issue.key}</strong>
                    <span>{issue.fields.summary || "-"}</span>
                    <small>
                      {issue.fields.status?.name || "-"} | {issue.fields.priority?.name || "-"}
                    </small>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="sidebar-jql" aria-hidden={issues.length > 0}>
            <p className="empty-state-jql">
              <strong>{t.currentJql}:</strong> {config.jql || "-"}
            </p>
            <button
              className="btn btn-soft btn-sm"
              onClick={tryBroaderSearch}
              type="button"
              disabled={isBusy}
            >
              {t.tryBroaderSearch}
            </button>
          </div>
          <hr />
          <h3>{t.createIssue}</h3>
          <div className="grid grid-2">
            <label>
              <span>{t.projectKey}</span>
              <input
                value={createForm.projectKey}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, projectKey: event.target.value }))
                }
              />
            </label>
            <label>
              <span>{t.issueType}</span>
              <select
                value={
                  issueTypes.length > 0
                    ? createForm.issueTypeId || issueTypes[0].id
                    : createForm.issueTypeName
                }
                onChange={(event) => {
                  const selectedValue = event.target.value;
                  if (issueTypes.length > 0) {
                    const selectedType = issueTypes.find((item) => item.id === selectedValue);
                    setCreateForm((prev) => ({
                      ...prev,
                      issueTypeId: selectedValue,
                      issueTypeName: selectedType?.name || prev.issueTypeName,
                    }));
                    return;
                  }
                  setCreateForm((prev) => ({
                    ...prev,
                    issueTypeName: selectedValue,
                  }));
                }}
              >
                {issueTypes.length === 0 && <option value="Task">Task</option>}
                {issueTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="span-2">
              <span>{t.summary}</span>
              <input
                value={createForm.summary}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, summary: event.target.value }))
                }
              />
            </label>
            <label className="span-2">
              <span>{t.description}</span>
              <textarea
                rows={4}
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </label>
            <label>
              <span>{t.priority}</span>
              <select
                value={createForm.priorityId}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, priorityId: event.target.value }))
                }
              >
                <option value="">-</option>
                {priorities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t.assigneeId}</span>
              <input
                value={createForm.assigneeAccountId}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    assigneeAccountId: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="actions">
            <button className="btn btn-primary" onClick={createIssue} type="button" disabled={isBusy}>
              {t.create}
            </button>
          </div>
        </aside>

        <main className="main-content card">
          {!issueDetails ? (
            <div className="welcome-view">
              <h2 className="welcome-title">{t.welcomeTitle}</h2>
              <p className="welcome-desc">{t.welcomeDesc}</p>
              <button
                type="button"
                className="welcome-box welcome-box-blue"
                onClick={() => document.querySelector<HTMLTextAreaElement>(".welcome-input-bottom")?.focus()}
              >
                <span className="welcome-box-icon">💬</span>
                <span>{t.writeTask}</span>
              </button>
              <div className="welcome-box welcome-box-green">
                <span className="welcome-box-icon">✓</span>
                <span>{t.receiveStory}</span>
              </div>
              <p className="quick-templates-label">{t.quickTemplates}</p>
              <div className="quick-templates">
                <button type="button" className="template-btn template-feature" onClick={() => applyQuickTemplate("feature")}>
                  <span className="template-icon">💡</span>
                  <span>{t.templateNewFeature}</span>
                </button>
                <button type="button" className="template-btn template-ux" onClick={() => applyQuickTemplate("ux")}>
                  <span className="template-icon">🚀</span>
                  <span>{t.templateUX}</span>
                </button>
                <button type="button" className="template-btn template-bug" onClick={() => applyQuickTemplate("bug")}>
                  <span className="template-icon">🐛</span>
                  <span>{t.templateBug}</span>
                </button>
                <button type="button" className="template-btn template-content" onClick={() => applyQuickTemplate("content")}>
                  <span className="template-icon">📄</span>
                  <span>{t.templateContent}</span>
                </button>
                <button type="button" className="template-btn template-value" onClick={() => applyQuickTemplate("value")}>
                  <span className="template-icon">⚡</span>
                  <span>{t.templateCheckValue}</span>
                </button>
                <button type="button" className="template-btn template-breakdown" onClick={() => applyQuickTemplate("breakdown")}>
                  <span className="template-icon">⊞</span>
                  <span>{t.templateBreakDown}</span>
                </button>
              </div>
              <div className="welcome-input-row">
                <textarea
                  className="welcome-input-bottom"
                  placeholder={t.describePlaceholder}
                  value={welcomeTaskInput}
                  onChange={(e) => setWelcomeTaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitWelcomeTask();
                    }
                  }}
                  rows={2}
                />
                <button
                  type="button"
                  className="btn-send"
                  onClick={submitWelcomeTask}
                  aria-label="שלח"
                >
                  <span className="send-icon">➤</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2>{t.issueDetails}</h2>
              <div className="meta">
                <div>
                  <strong>{t.selectIssue}:</strong> {issueDetails.key}
                </div>
                <div>
                  <strong>{t.status}:</strong> {issueDetails.fields.status?.name || "-"}
                </div>
                <div>
                  <strong>{t.type}:</strong> {issueDetails.fields.issuetype?.name || "-"}
                </div>
                <div>
                  <strong>{t.assignee}:</strong>{" "}
                  {issueDetails.fields.assignee?.displayName || t.unassigned}
                </div>
                <div>
                  <strong>{t.created}:</strong> {formatDate(issueDetails.fields.created)}
                </div>
                <div>
                  <strong>{t.updated}:</strong> {formatDate(issueDetails.fields.updated)}
                </div>
              </div>

              <div className="grid grid-2">
                <label className="span-2">
                  <span>{t.summary}</span>
                  <input
                    value={editForm.summary}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, summary: event.target.value }))
                    }
                  />
                </label>
                <label className="span-2">
                  <span>{t.description}</span>
                  <textarea
                    rows={5}
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>{t.priority}</span>
                  <select
                    value={editForm.priorityId}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, priorityId: event.target.value }))
                    }
                  >
                    <option value="">-</option>
                    {priorities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t.assigneeId}</span>
                  <input
                    value={editForm.assigneeAccountId}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        assigneeAccountId: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <h3>{t.searchUser}</h3>
              <div className="row">
                <input
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                  placeholder={t.userQuery}
                />
                <button className="btn btn-soft" onClick={searchUsers} type="button" disabled={isBusy}>
                  {t.find}
                </button>
              </div>
              <div className="user-results">
                {userResults.length === 0 && userQuery.trim() && <p>{t.noUsersFound}</p>}
                {userResults.map((user) => (
                  <button
                    key={user.accountId}
                    className="user-item"
                    onClick={() =>
                      setEditForm((prev) => ({
                        ...prev,
                        assigneeAccountId: user.accountId,
                      }))
                    }
                    type="button"
                  >
                    <strong>{user.displayName}</strong>
                    <span>{user.emailAddress || user.accountId}</span>
                  </button>
                ))}
              </div>

              <div className="actions">
                <button className="btn btn-primary" onClick={saveIssueChanges} type="button" disabled={isBusy}>
                  {t.saveChanges}
                </button>
              </div>

              <hr />

              <h3>{t.comments}</h3>
              <label>
                <span>{t.newComment}</span>
                <textarea
                  rows={3}
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                />
              </label>
              <div className="actions">
                <button className="btn btn-primary" onClick={addComment} type="button" disabled={isBusy}>
                  {t.addComment}
                </button>
              </div>
              <div className="comment-list">
                {comments.map((comment) => (
                  <div key={comment.id} className="comment-item">
                    <p>
                      <strong>{comment.author?.displayName || "-"}</strong> |{" "}
                      {formatDate(comment.updated || comment.created)}
                    </p>
                    {editingCommentId === comment.id ? (
                      <>
                        <textarea
                          rows={3}
                          value={editingCommentText}
                          onChange={(event) => setEditingCommentText(event.target.value)}
                        />
                        <div className="actions">
                          <button className="btn btn-primary btn-sm" onClick={() => saveComment(comment.id)} type="button">
                            {t.saveComment}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <pre>{toText(comment.body).trim()}</pre>
                        <div className="actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditingCommentText(toText(comment.body).trim());
                            }}
                            type="button"
                          >
                            {t.editComment}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <hr />

              <h3>{t.transitions}</h3>
              <div className="grid grid-2">
                <label>
                  <span>{t.transitionTo}</span>
                  <select
                    value={transitionId}
                    onChange={(event) => setTransitionId(event.target.value)}
                  >
                    <option value="">{language === "he" ? "בחר" : "Choose"}</option>
                    {transitions.map((transition) => (
                      <option key={transition.id} value={transition.id}>
                        {transition.name}
                        {transition.to?.name ? ` -> ${transition.to.name}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t.transitionComment}</span>
                  <input
                    value={transitionComment}
                    onChange={(event) => setTransitionComment(event.target.value)}
                  />
                </label>
              </div>
              <div className="actions">
                <button className="btn btn-primary" onClick={executeTransition} type="button" disabled={isBusy}>
                  {t.executeTransition}
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
