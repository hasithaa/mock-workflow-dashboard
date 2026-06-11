# Workflow Management Dashboard

A React dashboard for monitoring and managing Ballerina Workflow executions, human tasks, and
failed-activity retry tasks. The React SPA calls the **Ballerina `workflow.management` HTTP
service** directly — no separate backend proxy is needed.

```
Browser (React SPA)  ──►  Ballerina Management API  (default port 7234)
         (Vite proxy in dev)
```

---

## Features

| Page | Description |
|---|---|
| **Workflow Definitions** | Browse registered workflow types, check worker status, launch instances with a JSON editor |
| **Workflow Search** | Find executions by ID or by status / type / date filters |
| **Recent / Active** | Pre-filtered lists for last-hour and currently-running workflows |
| **Execution Detail** | Metadata, input/output, **Activity Tree** view, suspend / resume / terminate / cancel |
| **Human Tasks** | List by status, filter by task name or parent workflow, complete / reject / cancel in a split-panel |
| **Review Failures** | Manual-retry tasks for failed activities — retry with original or corrected input, or permanently fail |
| **Live Badge** | Sidebar badge shows pending human-task count; auto-refreshes every 15 s |

---

## Prerequisites

1. **Node.js 18+**
2. **A running Ballerina workflow application** with the management API enabled.

Add the following to that application's `Config.toml`:

```toml
[ballerina.workflow.management]
enableManagementApi = true
port            = 7234      # must match the Vite proxy target (see vite.config.js)
enableBasicAuth = false     # set true + configure [[ballerina.auth.users]] for production
```

> **Quickstart**: the `examples/management-api/` example is pre-configured and demonstrates
> human-task approval and manual-retry in one workflow.  It starts the management service on
> port **9091** — update the ConfigBar URL to `http://localhost:9091/workflow` after launching.

---

## Setup

```bash
# Install dependencies (one-time)
cd mock_ui && npm install
```

---

## Running

### Step 1 — Start a Ballerina workflow application

```bash
# Option A: the bundled management-api example
cd examples/management-api
bal run
```

This starts the workflow worker **and** the Ballerina Management API (port 9091 for the example).

### Step 2 — Start the React dev server

```bash
cd mock_ui
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

The Vite dev server proxies `/workflow/*` → `http://localhost:7234` by default.
If the management API runs on a different port (e.g. **9091** for the example), change the
base URL in the **ConfigBar** at the top of the page.

---

## Configuration (ConfigBar)

Click the **✎** icon in the top bar to open the inline editor.

| Field | Default | Purpose |
|---|---|---|
| **API base URL** | `/workflow` | Relative path (goes through Vite proxy) **or** a full URL for a different port, e.g. `http://localhost:9091/workflow` |
| **x-user-id** | _(empty)_ | Sent as `x-user-id` request header — recorded in the audit trail |
| **x-user-roles** | `admin` | Comma-separated roles sent as `x-user-roles` — controls `canComplete` on task summaries |
| **Basic auth user** | `admin` | HTTP Basic Auth username (only used when `enableBasicAuth = true` on the server) |
| **Basic auth password** | `workflowadmin` | HTTP Basic Auth password |

Settings are persisted in `localStorage` and applied to every API call immediately — no reload needed.

### Quick-connect for the `management-api` example

1. Click **✎** in the top bar
2. Set **API base URL** → `http://localhost:9091/workflow`
3. Set **x-user-roles** → `MANAGER,OPS`
4. Click **Save**

---

## Vite proxy

`vite.config.js` routes `/workflow/*` to the management API:

```js
server: {
  port: 3000,
  proxy: {
    '/workflow': 'http://localhost:7234',  // ← change port to match your Config.toml
  },
}
```

Update this value if you always run on a fixed non-default port, so you can use the default
relative base URL `/workflow` without touching the ConfigBar.

---

## Pages

| Route | Page |
|---|---|
| `/definitions` | Workflow Definitions |
| `/search` | Workflow Search |
| `/workflows/recent` | Recent Workflows (last hour) |
| `/workflows/active` | Active Workflows (RUNNING) |
| `/detail/:workflowId/:runId` | Execution Detail (+ Activity Tree tab + lifecycle actions) |
| `/tasks` | Human Tasks — All |
| `/tasks/pending` | Human Tasks — Pending |
| `/tasks/completed` | Human Tasks — Completed |
| `/tasks/search` | Human Task Search |
| `/review-failures` | Review Failures (manual-retry tasks) |
| `/review-failures/:taskId` | Review Failures — task selected |

---

## Management API endpoints used

All calls go to the configured **base URL** (default `/workflow`).

### Workflows
| Method | Path | Used by |
|---|---|---|
| `GET` | `/definitions` | Definitions page |
| `GET` | `/workflows` | Search, Recent, Active |
| `POST` | `/workflows` | Launch modal |
| `GET` | `/workflows/{id}/{runId}` | Detail page |
| `POST` | `/workflows/{id}/{runId}/suspend` | Detail — Suspend |
| `POST` | `/workflows/{id}/{runId}/resume` | Detail — Resume |
| `POST` | `/workflows/{id}/{runId}/terminate` | Detail — Terminate |
| `POST` | `/workflows/{id}/{runId}/cancel` | Detail — Cancel |
| `GET` | `/workflows/{id}/{runId}/activity-tree` | Detail — Activity Tree tab |

### Human Tasks
| Method | Path | Used by |
|---|---|---|
| `GET` | `/human-tasks` | Human Tasks pages |
| `GET` | `/human-tasks/pending-count` | Sidebar badge |
| `GET` | `/human-tasks/{taskId}` | Task detail panel |
| `POST` | `/human-tasks/{taskId}/complete` | Task — Complete |
| `POST` | `/human-tasks/{taskId}/fail` | Task — Reject/Fail |
| `POST` | `/human-tasks/{taskId}/cancel` | Task — Cancel |

### Retry Tasks (Review Failures)
| Method | Path | Used by |
|---|---|---|
| `GET` | `/retry-tasks` | Review Failures page |
| `GET` | `/retry-tasks/{taskId}` | Retry task detail panel |
| `POST` | `/retry-tasks/{taskId}/retry` | Retry with original input |
| `POST` | `/retry-tasks/{taskId}/retry-with-input` | Retry with corrected input |
| `POST` | `/retry-tasks/{taskId}/fail` | Permanently fail the activity |

---

## Project structure

```
mock_ui/
├── README.md
├── package.json                      # npm scripts: dev, build, lint, preview
├── vite.config.js                    # dev server + /workflow proxy
├── index.html
├── eslint.config.js
├── public/
└── src/
    ├── App.jsx                       # route definitions
    ├── api/
    │   └── managementApi.js          # central API client (reads config from localStorage)
    ├── components/
    │   ├── Layout.jsx                # sidebar + pending badge
    │   ├── ConfigBar.jsx             # top bar — URL, identity, auth credentials
    │   ├── StatusBadge.jsx           # coloured status badge
    │   └── TaskDetail.jsx            # human-task panel + complete/reject/cancel forms
    └── pages/
        ├── DefinitionsPage.jsx
        ├── SearchPage.jsx
        ├── WorkflowListPage.jsx
        ├── DetailPage.jsx             # + Activity Tree + lifecycle buttons
        ├── HumanTasksPage.jsx
        ├── HumanTaskSearchPage.jsx
        └── ReviewFailuresPage.jsx     # manual-retry task management
```

---

## Enabling authentication for production

Set `enableBasicAuth = true` and add users to the Ballerina file user store:

```toml
[ballerina.workflow.management]
enableManagementApi = true
port            = 7234
enableBasicAuth = true

[[ballerina.auth.users]]
username = "ops"
password = "s3cret!"
scopes   = ["admin", "OPS", "MANAGER"]
```

Then open the ConfigBar and update **Basic auth user** / **Basic auth password** to match.

For JWT or API-key authentication, see the configurable variables documented at the top of
`ballerina/modules/management/service.bal`.
