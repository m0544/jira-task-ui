# Jira Task UI (React + Node.js)

ממשק מקומי לניהול משימות Jira Cloud:
- צפייה ברשימת משימות לפי JQL
- צפייה בפרטי משימה
- עריכת שדות (Summary, Description, Priority, Assignee)
- הוספה ועריכה של תגובות
- שינוי סטטוס (Transitions)
- יצירת משימה חדשה

---

## למי זה מתאים

אם אין לך ניסיון עם Jira API - זה בדיוק בשבילך.  
המדריך כאן מסביר מהאפס:
1. איך ליצור API Token
2. איך לחבר את הממשק לחשבון Jira שלך
3. איך לעבוד נכון עם ה-API בלי להסתבך

---

## ארכיטקטורה קצרה

- `client` - אפליקציית React (מסך משתמש)
- `server` - שרת Express שמדבר עם Jira API
- ה-Client שולח ל-Server את פרטי החיבור (`Jira URL`, אימייל, API Token) ב-Headers
- ה-Server מתקשר ל-Jira Cloud דרך REST API v3

למה ככה?
- הדפדפן לא פונה ישירות ל-Jira (יותר מסודר וקל לניהול)
- אפשר להוסיף לוגיקה ואבטחה בצד שרת

---

## דרישות מוקדמות

1. חשבון Jira Cloud פעיל (כתובת בסגנון `https://something.atlassian.net`)
2. הרשאה לראות ולעדכן Issues בפרויקט הרלוונטי
3. Node.js גרסה 18 ומעלה (מומלץ 20+)
4. npm (מגיע עם Node.js)

בדיקת גרסה:

```bash
node -v
npm -v
```

---

## שלב 1 - יצירת API Token ב-Jira Cloud (הכי מדויק למתחילים)

> חשוב: זה API Token של Atlassian Account (לא סיסמה רגילה).
1. היכנס לחשבון Atlassian שלך.
2. פתח את ניהול החשבון: `https://id.atlassian.com/manage-profile/security/api-tokens`
3. לחץ על **Create API token**
4. תן שם ברור לטוקן (למשל: `jira-task-ui-local`)
5. לחץ **Create**
6. לחץ **Copy** ושמור את הטוקן במקום בטוח (לא תוכל לראות אותו שוב אחרי שתסגור)

טיפ:
- אם החשבון שלך עם 2FA / SSO - API Token הוא הדרך הנכונה להתחבר ל-REST API.

---

## שלב 2 - התקנה והרצה

מהטרמינל (PowerShell):

```bash
cd C:\Users\User\jira-task-ui
npm install
npm install --prefix server
npm install --prefix client
npm run dev
```

לאחר מכן:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

---

## שלב 3 - חיבור הממשק ל-Jira (דרך UI)

במסך ההגדרות בממשק תמלא:

1. **Jira URL**  
   דוגמה: `https://your-company.atlassian.net`

2. **Jira Email**  
   האימייל של חשבון Atlassian שלך

3. **API Token**  
   הטוקן שיצרת בשלב 1

4. **Default Project Key** (מומלץ)  
   דוגמה: `PROJ`

5. **JQL**  
   ברירת מחדל: `assignee = currentUser() ORDER BY updated DESC`

6. לחץ:
   - **Save Local Settings**
   - **Test Connection**
   - **Load Field Metadata**
   - **Load Issues**

אם החיבור מצליח - תראה `Connected as ...` ותוכל לעבוד על משימות.

---

## שלב 4 - עבודה יומיומית בממשק

### צפייה במשימות
- לחץ `Load Issues`
- בחר משימה מהרשימה בצד שמאל

### עריכת משימה
- עדכן `Summary`, `Description`, `Priority`, `Assignee Account ID`
- לחץ `Save Issue Changes`

### תגובות
- הוסף תגובה חדשה דרך `Add Comment`
- לעריכת תגובה קיימת: `Edit Comment` ואז `Save Comment`

### שינוי סטטוס
- בחר Transition מהרשימה
- אופציונלית הוסף הערה
- לחץ `Execute Transition`

### יצירת משימה חדשה
- מלא `Project Key`, `Issue Type`, `Summary`, `Description`
- לחץ `Create Issue`

---

## חיבור דרך `.env` (אופציונלי)

אם אתה לא רוצה להזין פרטי חיבור בכל פעם ב-UI:

1. העתק:
   - `server/.env.example` -> `server/.env`
2. מלא:
   - `JIRA_BASE_URL`
   - `JIRA_EMAIL`
   - `JIRA_API_TOKEN`

השרת יוכל להשתמש בזה כברירת מחדל.

---

## Jira API למתחילים - הסבר יסודי

### אימות (Authentication)

ב-Jira Cloud משתמשים ב-Basic Auth בפורמט:

`Authorization: Basic base64(email:apiToken)`

דוגמה ליצירת המחרוזת (לימודית):

```js
const token = Buffer.from(`${email}:${apiToken}`).toString("base64");
const authHeader = `Basic ${token}`;
```

### למה לא סיסמה?
- Jira Cloud לא מיועד ל-REST עם סיסמת משתמש רגילה
- API Token בטוח ונשלט יותר

### מבנה בקשה בסיסית ל-Jira API

```bash
GET https://your-domain.atlassian.net/rest/api/3/myself
```

Headers:
- `Authorization: Basic ...`
- `Accept: application/json`

אם זה מחזיר פרטי משתמש -> החיבור תקין.

---

## מיפוי הפעולות בממשק ל-API של Jira

השרת שלך קורא ל-endpoints הבאים:

- בדיקת חיבור:
  - `POST /rest/api/3/myself`

- טעינת משימות:
  - `POST /rest/api/3/search/jql`

- פרטי משימה:
  - `GET /rest/api/3/issue/{issueKey}`

- עדכון משימה:
  - `PUT /rest/api/3/issue/{issueKey}`

- יצירת משימה:
  - `POST /rest/api/3/issue`

- תגובות:
  - `GET /rest/api/3/issue/{issueKey}/comment`
  - `POST /rest/api/3/issue/{issueKey}/comment`
  - `PUT /rest/api/3/issue/{issueKey}/comment/{commentId}`

- מעברי סטטוס:
  - `GET /rest/api/3/issue/{issueKey}/transitions`
  - `POST /rest/api/3/issue/{issueKey}/transitions`

---

## הערה חשובה על Description/Comment ב-Jira Cloud (ADF)

Jira Cloud דורש לעיתים קרובות פורמט ADF (Atlassian Document Format) בשדות טקסט עשיר.  
בפרויקט הזה ההמרה לטקסט -> ADF נעשית בשרת באופן אוטומטי, כך שאתה מזין טקסט רגיל.

---

## פתרון תקלות נפוצות

### 401 Unauthorized
בדוק:
1. Jira URL נכון (כולל `https://`)
2. האימייל נכון
3. ה-API Token נכון ועדכני
4. לא הכנסת רווחים מיותרים

### 403 Forbidden
החיבור תקין אבל אין הרשאה.  
בדוק הרשאות בפרויקט (Browse / Edit / Transition / Comment).

### 400 Bad Request
בדרך כלל שדה חסר או ערך לא תקין:
- `projectKey` לא נכון
- `issueTypeName` לא קיים בפרויקט
- `priorityId` או `assigneeAccountId` לא תקין

### לא מופיעות משימות
- ייתכן שה-JQL מחזיר 0 תוצאות
- נסה JQL פשוט:
  - `project = PROJ ORDER BY created DESC`

---

## אבטחה - חשוב לקרוא

כרגע הממשק שומר הגדרות בדפדפן מקומי (Local Storage).  
להרצה מקומית זה נוח, אבל בסביבת ייצור:
- עדיף לא לשמור Token בדפדפן
- מומלץ לנהל סודות בשרת בלבד (Secret Manager / ENV)
- להשתמש ב-OAuth 2.0 אם המוצר מיועד למשתמשים רבים

---

## סקריפטים שימושיים

מתיקיית השורש `jira-task-ui`:

```bash
npm run dev
```

רק שרת:

```bash
npm run dev:server
```

רק לקוח:

```bash
npm run dev:client
```

---

## מה אפשר להרחיב בהמשך

- סינון מתקדם לפי סטטוס/תוויות
- Pagination לרשימות גדולות
- OAuth 2.0 במקום API Token
- שמירת audit log לפעולות עריכה
- הרשאות לפי משתמשי מערכת פנימיים

