# Workflow Management UI - Design Document

## Architecture Overview

The workflow management UI uses a **Management API-first architecture** where the frontend communicates directly with the Ballerina workflow management HTTP service:

```
User Portal (React SPA) → API Gateway → Workflow Management API → Temporal
                         (AuthN/AuthZ)  (ballerina/workflow.management HTTP service)
```

**Key architectural decision:** The frontend calls the Management API directly. There is **no backend proxy layer**. The current mock UI Express backend will be removed.

### Key Principles

1. **Management API as HTTP Service**: The Ballerina `workflow.management` module is exposed as a built-in HTTP service that integrations can enable.

2. **Gateway-Based Authentication**: The workflow.management API fronted by an API gateway that handles authentication and authorization for WSO2 Integration cloud usecases.

3. **Header-Based Identity Propagation**: Gateway forwards `x-user-roles` and `x-user-id` headers to the management API for authorization and audit purposes.

4. **No Direct Temporal Access**: UI talks only to the management API, never directly to Temporal. This provides:
   - Consistent UI across all workflow integrations
   - Better control over exposed features
   - Domain-specific authorization and validation

5. **Authentication Modes**:
   - **Non-secured mode** (In Data-Plane): Management API relies on `x-user-roles` and `x-user-id` headers from the gateway
   - **Secured mode**: Management API validates OAuth tokens or API keys, uses token claims for authz/audit, and ignores forwarded headers. Useful in other usecases.

### User Flow

1. User logs into the user portal
2. User sees the list of workflow integrations
3. User selects an integration
4. Portal shows workflow instances for that integration (via the management API of that integration)
5. User can perform actions: start workflows, complete tasks, review failures

---

## UI Features → Management API Requirements

This section maps each UI feature to the Management API HTTP endpoints it requires. All HTTP APIs listed are implemented in the `ballerina/workflow.management` HTTP service (base path `/workflow`, port 7234 by default).

### 1. Workflow Definitions Page

**UI Route:** `/definitions`

**Features:**
- List all registered workflow types
- Filter by Active/Inactive/All
- Show worker count and status
- Launch modal to start new workflow
- Click definition to see instances

**Required Management API Endpoints:**

| HTTP Method | Endpoint | Status | Purpose |
|-------------|----------|--------|---------|
| GET | `/workflow-api/definitions` | ✅ **Done** | List all workflow types with schema and worker info |

**Request Example:**
```http
GET /workflow-api/definitions
x-user-id: user@example.com
x-user-roles: admin
```

**Response Example:**
```json
{
  "definitions": [
    {
      "workflowType": "orderProcessingWorkflow",
      "inputSchema": null,
      "isActive": true,
      "workerCount": 3,
      "description": "Process customer orders"
    }
  ]
}
```

---

### 2. Search & Browse Workflows

**UI Routes:** `/search`, `/workflows/recent`, `/workflows/active`

**Features:**
- List workflow instances with pagination
- Filter by type, status, time range
- Search by workflow ID
- "Start like this" action (copy input)
- Navigate to detail page

**Required Management API Endpoints:**

| HTTP Method | Endpoint | Status | Purpose |
|-------------|----------|--------|---------|
| GET | `/workflow-api/workflows` | ✅ **Done** | List workflow instances (paginated) |
| GET | `/workflow-api/workflows/:workflowId/:runId` | ✅ **Done** | Get workflow execution details |

**Request Example (List):**
```http
GET /workflow-api/workflows?status=RUNNING&workflowType=orderProcessing&limit=20&pageToken=abc123
x-user-id: user@example.com
x-user-roles: admin
```

**Response Example (List):**
```json
{
  "items": [
    {
      "workflowId": "order-12345",
      "runId": "run-abc",
      "workflowType": "orderProcessingWorkflow",
      "status": "RUNNING",
      "startTime": "2026-06-01T10:00:00Z",
      "closeTime": null,
      "input": {"orderId": "ORD-123"}
    }
  ],
  "nextPageToken": "xyz789",
  "hasMore": true
}
```

**Request Example (Detail):**
```http
GET /workflow-api/workflows/order-12345/run-abc
x-user-id: user@example.com
x-user-roles: admin
```

**Response Example (Detail):**
```json
{
  "workflowId": "order-12345",
  "runId": "run-abc",
  "workflowType": "orderProcessingWorkflow",
  "status": "RUNNING",
  "startTime": "2026-06-01T10:00:00Z",
  "closeTime": null,
  "input": {"orderId": "ORD-123"},
  "result": null,
  "errorMessage": null,
  "history": [...]
}
```

**Query Parameters:**
- `workflowType` (string, optional)
- `status` (string, optional): `RUNNING|COMPLETED|FAILED|CANCELED|TERMINATED`
- `workflowId` (string, optional) - Exact match or prefix search
- `startTimeFrom` (ISO-8601, optional)
- `startTimeTo` (ISO-8601, optional)
- `closeTimeFrom` (ISO-8601, optional)
- `closeTimeTo` (ISO-8601, optional)
- `limit` (int, optional, default: 20, max: 100)
- `pageToken` (string, optional) - Continuation token

---

### 3. Start Workflow

**UI Route:** `/workflows/start`

**Features:**
- Dropdown to select workflow type
- JSON editor for input
- Optional workflow ID
- Validation before start

**Required Management API Endpoints:**

| HTTP Method | Endpoint | Status | Purpose |
|-------------|----------|--------|---------|
| POST | `/workflow-api/workflows` | ✅ **Done** | Start a new workflow instance |

**Request Example:**
```http
POST /workflow-api/workflows
Content-Type: application/json
x-user-id: user@example.com
x-user-roles: admin

{
  "workflowType": "orderProcessingWorkflow",
  "input": {
    "orderId": "ORD-123",
    "amount": 99.99
  },
  "workflowId": "order-12345",
  "timeoutSeconds": 3600
}
```

**Response Example:**
```json
{
  "workflowId": "order-12345",
  "runId": "run-abc123"
}
```

---

### 4. Workflow Instance Detail & Operations

**UI Route:** `/detail/:workflowId/:runId`

**Features:**
- View workflow metadata
- View input and result
- Operations: Suspend, Resume, Terminate, Cancel
- View activity tree
- View execution graph
- View child human tasks

**Required Management API Endpoints:**

| HTTP Method | Endpoint | Status | Purpose |
|-------------|----------|--------|---------|
| POST | `/workflow-api/workflows/:workflowId/:runId/suspend` | ✅ **Done** | Suspend workflow execution |
| POST | `/workflow-api/workflows/:workflowId/:runId/resume` | ✅ **Done** | Resume suspended workflow |
| POST | `/workflow-api/workflows/:workflowId/:runId/terminate` | ✅ **Done** | Terminate workflow |
| POST | `/workflow-api/workflows/:workflowId/:runId/cancel` | ✅ **Done** | Cancel workflow gracefully |
| GET | `/workflow-api/workflows/:workflowId/:runId/history` | ✅ **Done** | Get execution history events |
| GET | `/workflow-api/workflows/:workflowId/:runId/activity-tree` | ✅ **Done** | Get activity tree structure |
| GET | `/workflow-api/workflows/:workflowId/:runId/execution-graph` | ✅ **Done** | Get execution graph for visualization |

**Request Example (Terminate):**
```http
POST /workflow-api/workflows/order-12345/run-abc/terminate
Content-Type: application/json
x-user-id: user@example.com
x-user-roles: admin

{
  "reason": "Manual termination by admin"
}
```

**Response Example:**
```json
{
  "success": true,
  "terminatedAt": "2026-06-01T12:00:00Z"
}
```

**Request Example (Activity Tree):**
```http
GET /workflow-api/workflows/order-12345/run-abc/activity-tree
x-user-id: user@example.com
x-user-roles: admin
```

**Response Example (Activity Tree):**
```json
{
  "nodes": [
    {
      "id": "1",
      "name": "validateOrder",
      "type": "ACTIVITY",
      "status": "COMPLETED",
      "startTime": "2026-06-01T10:00:01Z",
      "endTime": "2026-06-01T10:00:02Z",
      "input": {"orderId": "ORD-123"},
      "output": {"valid": true},
      "attempt": 1
    },
    {
      "id": "2",
      "name": "approveExpense",
      "type": "HUMAN_TASK",
      "status": "PENDING",
      "startTime": "2026-06-01T10:00:03Z",
      "taskId": "humantask-order-12345-approve-uuid"
    }
  ]
}
```

---

### 5. Human Tasks List

**UI Routes:** `/tasks`, `/tasks/pending`, `/tasks/completed`

**Features:**
- List human tasks with pagination
- Filter by status, parent workflow, task name, time range
- Search by task ID
- "My Tasks" filter
- Click to open detail

**Required Management API Endpoints:**

| HTTP Method | Endpoint | Status | Purpose |
|-------------|----------|--------|---------|
| GET | `/workflow-api/human-tasks` | ✅ **Done** | List human tasks (paginated) |
| GET | `/workflow-api/human-tasks/pending-count` | ✅ **Done** | Get count of pending tasks (for badge) |

**Request Example:**
```http
GET /workflow-api/human-tasks?status=PENDING&parentWorkflowType=orderProcessing&limit=20
x-user-id: user@example.com
x-user-roles: finance_approver
```

**Response Example:**
```json
{
  "items": [
    {
      "taskId": "humantask-order-12345-approve-uuid",
      "taskName": "approveExpense",
      "parentWorkflowId": "order-12345",
      "parentWorkflowType": "orderProcessingWorkflow",
      "status": "PENDING",
      "startTime": "2026-06-01T10:00:00Z",
      "closeTime": null,
      "canComplete": true
    }
  ],
  "nextPageToken": null,
  "hasMore": false
}
```

**Query Parameters:**
- `status` (string, optional): `PENDING|COMPLETED|FAILED|CANCELED|TIMED_OUT`
- `parentWorkflowId` (string, optional)
- `parentWorkflowType` (string, optional)
- `taskName` (string, optional)
- `userRole` (string, optional) - Filter to tasks this role can complete
- `onlyMyTasks` (boolean, optional) - Filter by `x-user-id`
- `startTimeFrom` (ISO-8601, optional)
- `startTimeTo` (ISO-8601, optional)
- `closeTimeFrom` (ISO-8601, optional)
- `closeTimeTo` (ISO-8601, optional)
- `limit` (int, optional, default: 20, max: 100)
- `pageToken` (string, optional)

---

### 6. Human Task Detail & Operations

**UI Route:** `/tasks/:taskId`

**Features:**
- View task metadata
- View payload context
- View form schema (when available)
- Complete task with result
- Fail/reject task with reason
- Cancel task

**Required Management API Endpoints:**

| HTTP Method | Endpoint | Status | Purpose |
|-------------|----------|--------|---------|
| GET | `/workflow-api/human-tasks/:taskId` | ✅ **Done** | Get task detail with form schema |
| POST | `/workflow-api/human-tasks/:taskId/complete` | ✅ **Done** | Complete task with result |
| POST | `/workflow-api/human-tasks/:taskId/fail` | ✅ **Done** | Fail/reject task with reason |
| POST | `/workflow-api/human-tasks/:taskId/cancel` | ✅ **Done** | Cancel task |

**Request Example (Get Detail):**
```http
GET /workflow-api/human-tasks/humantask-order-12345-approve-uuid
x-user-id: user@example.com
x-user-roles: finance_approver
```

**Response Example (Get Detail):**
```json
{
  "taskId": "humantask-order-12345-approve-uuid",
  "taskName": "approveExpense",
  "title": "Approve Expense: ORD-123",
  "description": "Review and approve expense request",
  "parentWorkflowId": "order-12345",
  "parentWorkflowType": "orderProcessingWorkflow",
  "status": "PENDING",
  "startTime": "2026-06-01T10:00:00Z",
  "closeTime": null,
  "userRoles": ["finance_approver", "admin"],
  "payload": {
    "orderId": "ORD-123",
    "amount": 99.99,
    "requester": "john@example.com"
  },
  "formSchema": null,
  "result": null,
  "failure": null,
  "completedBy": null,
  "completedAt": null
}
```

**Request Example (Complete):**
```http
POST /workflow-api/human-tasks/humantask-order-12345-approve-uuid/complete
Content-Type: application/json
x-user-id: user@example.com
x-user-roles: finance_approver

{
  "result": {
    "approved": true,
    "comment": "Approved - all documents verified"
  }
}
```

**Response Example (Complete):**
```json
{
  "success": true,
  "completedBy": "user@example.com",
  "completedAt": "2026-06-01T11:00:00Z"
}
```

**Request Example (Fail):**
```http
POST /workflow-api/human-tasks/humantask-order-12345-approve-uuid/fail
Content-Type: application/json
x-user-id: user@example.com
x-user-roles: finance_approver

{
  "reason": "Missing required documents",
  "details": {
    "missingDocs": ["invoice", "receipt"]
  }
}
```

---

### 7. Review Failures (Manual Retry Tasks)

**UI Routes:** `/review-failures`, `/review-failures/:taskId`

**Features:**
- List manual retry tasks (failed activities)
- View failure context and error message
- Retry with original input
- Edit and retry with modified input
- Permanently fail

**Required Management API Endpoints:**

| HTTP Method | Endpoint | Status | Purpose |
|-------------|----------|--------|---------|
| GET | `/workflow-api/retry-tasks` | ✅ **Done** | List manual retry tasks (paginated) |
| GET | `/workflow-api/retry-tasks/:taskId` | ✅ **Done** | Get retry task detail with error context |
| POST | `/workflow-api/retry-tasks/:taskId/retry` | ✅ **Done** | Retry with original input |
| POST | `/workflow-api/retry-tasks/:taskId/retry-with-input` | ✅ **Done** | Retry with modified input |
| POST | `/workflow-api/retry-tasks/:taskId/fail` | ✅ **Done** | Permanently fail (cancel retry) |

**Request Example (List):**
```http
GET /workflow-api/retry-tasks?status=PENDING&limit=20
x-user-id: user@example.com
x-user-roles: admin
```

**Response Example (List):**
```json
{
  "items": [
    {
      "taskId": "retrytask-order-12345-sendEmail-uuid",
      "taskName": "sendEmailRetry",
      "activityName": "sendConfirmationEmail",
      "parentWorkflowId": "order-12345",
      "status": "PENDING",
      "startTime": "2026-06-01T10:00:00Z",
      "closeTime": null,
      "errorMessage": "SMTP connection timeout"
    }
  ],
  "nextPageToken": null,
  "hasMore": false
}
```

**Request Example (Get Detail):**
```http
GET /workflow-api/retry-tasks/retrytask-order-12345-sendEmail-uuid
x-user-id: user@example.com
x-user-roles: admin
```

**Response Example (Get Detail):**
```json
{
  "taskId": "retrytask-order-12345-sendEmail-uuid",
  "taskName": "sendEmailRetry",
  "activityName": "sendConfirmationEmail",
  "parentWorkflowId": "order-12345",
  "status": "PENDING",
  "startTime": "2026-06-01T10:00:00Z",
  "closeTime": null,
  "userRoles": ["admin"],
  "errorMessage": "SMTP connection timeout after 30s",
  "activityArgs": {
    "to": "customer@example.com",
    "subject": "Order Confirmation",
    "orderId": "ORD-123"
  },
  "createdAt": "2026-06-01T10:00:00Z"
}
```

**Request Example (Retry with Modified Input):**
```http
POST /workflow-api/retry-tasks/retrytask-order-12345-sendEmail-uuid/retry-with-input
Content-Type: application/json
x-user-id: user@example.com
x-user-roles: admin

{
  "input": {
    "to": "customer@example.com",
    "subject": "Order Confirmation",
    "orderId": "ORD-123",
    "smtpTimeout": 60
  }
}
```

**Response Example:**
```json
{
  "success": true,
  "decision": "retry-with-input",
  "decidedBy": "user@example.com",
  "decidedAt": "2026-06-01T11:00:00Z"
}
```

---

## Management API HTTP Service Specification

> **Implementation Status:** All endpoints below are **implemented** in the `ballerina/workflow.management` module (`service.bal`). The service runs at base path `/workflow` (configurable port, default 7234). Time-based query filters (`startTimeFrom`, `startTimeTo`, `closeTimeFrom`, `closeTimeTo`) are **not yet implemented** — listed in the parameter tables for completeness.

### Service Configuration

```ballerina
import ballerina/workflow.management;

public function main() returns error? {
    // Start workflows
    _ = check workflow:run(orderProcessingWorkflow, input);
    
    // Enable Management API HTTP service
    check management:startManagementService({
        port: 9090,
        basePath: "/workflow-api",
        auth: {
            mode: "none",  // or "oauth", "apikey", "basic"
            requireUserHeaders: true
        },
        cors: {
            allowOrigins: ["https://portal.example.com"],
            allowMethods: ["GET", "POST"],
            allowHeaders: ["x-user-id", "x-user-roles"]
        }
    });
}
```

### Common Request Headers

All endpoints require these headers:

| Header | Required | Description |
|--------|----------|-------------|
| `x-user-id` | Yes | User identifier for audit trail |
| `x-user-roles` | Yes | Comma-separated roles for authorization |
| `Authorization` | Depends | Bearer token (required in secured mode) |
| `Content-Type` | For POST | `application/json` |

### Common Response Format

**Success Response:**
```json
{
  "success": true,
  ...additional fields
}
```

**Error Response:**
```json
{
  "error": {
    "code": "TASK_ALREADY_COMPLETED",
    "message": "Human task is already completed",
    "details": {...}
  }
}
```

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Success (GET requests) |
| 201 | Created (POST workflows) |
| 400 | Bad Request (invalid input) |
| 401 | Unauthorized (missing/invalid auth) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found (workflow/task doesn't exist) |
| 409 | Conflict (task already completed) |
| 500 | Internal Error (Temporal connection failure) |

### Complete Endpoint List

#### Workflow Definition Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/workflow-api/definitions` | GET | User | List all workflow types |

#### Workflow Instance Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/workflow-api/workflows` | GET | User | List workflow instances (paginated) |
| `/workflow-api/workflows` | POST | User | Start new workflow |
| `/workflow-api/workflows/:workflowId/:runId` | GET | User | Get workflow details |
| `/workflow-api/workflows/:workflowId/:runId/suspend` | POST | User | Suspend workflow |
| `/workflow-api/workflows/:workflowId/:runId/resume` | POST | User | Resume workflow |
| `/workflow-api/workflows/:workflowId/:runId/terminate` | POST | Admin | Terminate workflow |
| `/workflow-api/workflows/:workflowId/:runId/cancel` | POST | User | Cancel workflow |
| `/workflow-api/workflows/:workflowId/:runId/history` | GET | User | Get execution history |
| `/workflow-api/workflows/:workflowId/:runId/activity-tree` | GET | User | Get activity tree |
| `/workflow-api/workflows/:workflowId/:runId/execution-graph` | GET | User | Get execution graph |

#### Human Task Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/workflow-api/human-tasks` | GET | User | List human tasks (paginated) |
| `/workflow-api/human-tasks/pending-count` | GET | User | Get pending task count |
| `/workflow-api/human-tasks/:taskId` | GET | User | Get task details |
| `/workflow-api/human-tasks/:taskId/complete` | POST | Role-based | Complete task |
| `/workflow-api/human-tasks/:taskId/fail` | POST | Role-based | Fail task |
| `/workflow-api/human-tasks/:taskId/cancel` | POST | Role-based | Cancel task |

#### Manual Retry Task Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/workflow-api/retry-tasks` | GET | User | List retry tasks (paginated) |
| `/workflow-api/retry-tasks/:taskId` | GET | User | Get retry task details |
| `/workflow-api/retry-tasks/:taskId/retry` | POST | Role-based | Retry with original input |
| `/workflow-api/retry-tasks/:taskId/retry-with-input` | POST | Role-based | Retry with modified input |
| `/workflow-api/retry-tasks/:taskId/fail` | POST | Role-based | Cancel retry, fail parent |

---

## Ballerina Module Changes Required

The `ballerina/workflow.management` module currently provides Ballerina APIs but no HTTP service. The following changes are needed:

### New Module APIs Required

```ballerina
// NEW: Enable HTTP service
public isolated function startManagementService(
    ManagementServiceConfig config
) returns error?

// NEW: Paginated workflow listing
public isolated function listWorkflowInstances(
    WorkflowInstanceFilter filter = {},
    int limit = 20,
    string? pageToken = ()
) returns WorkflowInstancePage|error

// NEW: Start workflow
public isolated function startWorkflow(
    string workflowType,
    anydata input,
    WorkflowStartOptions options = {}
) returns WorkflowHandle|error

// NEW: Terminate workflow
public isolated function terminateWorkflow(
    string workflowId,
    string runId,
    string? reason = ()
) returns error?

// NEW: Cancel workflow
public isolated function cancelWorkflow(
    string workflowId,
    string runId
) returns error?

// NEW: Fail human task
public isolated function failHumanTask(
    string taskId,
    string reason,
    map<json>? details = (),
    [string, string...]? callerRoles = ()
) returns error?

// NEW: Cancel human task
public isolated function cancelHumanTask(
    string taskId,
    [string, string...]? callerRoles = ()
) returns error?

// NEW: Get workflow history
public isolated function getWorkflowHistory(
    string workflowId,
    string runId
) returns HistoryEvent[]|error

// NEW: Get activity tree
public isolated function getActivityTree(
    string workflowId,
    string runId
) returns ActivityTreeNode[]|error

// NEW: Get execution graph
public isolated function getExecutionGraph(
    string workflowId,
    string runId
) returns ExecutionGraph|error

// NEW: Get pending task count
public isolated function getPendingHumanTaskCount(
    string? userId = ()
) returns int|error
```

### Changes to Existing APIs

```ballerina
// CHANGE: Add pagination support
public isolated function listAllHumanTasks(
    string? status = (),
    int limit = 20,           // NEW parameter
    string? pageToken = ()    // NEW parameter
) returns HumanTaskPage|error  // NEW return type with pagination

// CHANGE: Add pagination support
public isolated function listAllRetryTasks(
    string? status = (),
    int limit = 20,           // NEW parameter
    string? pageToken = ()    // NEW parameter
) returns RetryTaskPage|error  // NEW return type with pagination

// CHANGE: Add completion metadata tracking
public isolated function completeHumanTask(
    string taskWorkflowId,
    anydata result,
    [string, string...]? callerRoles = (),
    string? userId = ()       // NEW parameter for audit
) returns CompletionInfo|error  // NEW return type with metadata

// CHANGE: Add completion metadata tracking
public isolated function completeRetryTask(
    string taskWorkflowId,
    RetryDecision decision,
    [string, string...]? callerRoles = (),
    string? userId = ()       // NEW parameter for audit
) returns CompletionInfo|error  // NEW return type with metadata
```

### New Type Definitions Required

```ballerina
// HTTP Service Configuration
public type ManagementServiceConfig record {|
    int port = 9090;
    string basePath = "/workflow-api";
    AuthConfig? auth = ();
    CorsConfig? cors = ();
    int maxPageSize = 100;
    int defaultPageSize = 20;
|};

public type AuthConfig record {|
    AuthMode mode = NONE;
    boolean requireUserHeaders = true;
    // Mode-specific configs...
|};

public enum AuthMode {
    NONE, OAUTH, API_KEY, BASIC
}

// Workflow instance types
public type WorkflowInstanceFilter record {|
    string? workflowType = ();
    string? workflowId = ();
    WorkflowStatus? status = ();
    string? startTimeFrom = ();
    string? startTimeTo = ();
    string? closeTimeFrom = ();
    string? closeTimeTo = ();
    boolean excludeHumanTasks = true;
    boolean excludeRetryTasks = true;
|};

public enum WorkflowStatus {
    RUNNING, COMPLETED, FAILED, CANCELED, TERMINATED, TIMED_OUT
}

public type WorkflowInstancePage record {|
    WorkflowInstanceSummary[] items;
    string? nextPageToken;
    boolean hasMore;
|};

public type WorkflowInstanceSummary record {|
    string workflowId;
    string runId;
    string workflowType;
    WorkflowStatus status;
    string startTime;
    string? closeTime;
    anydata? input;
|};

public type WorkflowHandle record {|
    string workflowId;
    string runId;
|};

public type WorkflowStartOptions record {|
    string? workflowId = ();
    int? timeoutSeconds = ();
|};

// Completion metadata
public type CompletionInfo record {|
    boolean success;
    string completedBy;
    string completedAt;
|};

// Pagination for tasks
public type HumanTaskPage record {|
    HumanTaskSummary[] items;
    string? nextPageToken;
    boolean hasMore;
|};

public type RetryTaskPage record {|
    RetryTaskSummary[] items;
    string? nextPageToken;
    boolean hasMore;
|};

// Execution visualization
public type HistoryEvent record {|
    int eventId;
    string eventType;
    string timestamp;
    map<json> attributes;
|};

public type ActivityTreeNode record {|
    string id;
    string name;
    ActivityNodeType 'type;
    string status;
    string? startTime;
    string? endTime;
    anydata? input;
    anydata? output;
    FailureInfo? failure;
    int attempt;
    ActivityTreeNode[]? children;
|};

public enum ActivityNodeType {
    ACTIVITY, TIMER, SIGNAL, CHILD_WORKFLOW, HUMAN_TASK, RETRY_TASK
}

public type ExecutionGraph record {|
    GraphNode[] nodes;
    GraphEdge[] edges;
|};

public type GraphNode record {|
    string id;
    string label;
    ActivityNodeType 'type;
    string status;
    map<json>? metadata;
|};

public type GraphEdge record {|
    string 'source;
    string target;
    string? label;
|};
```

### Changes to Existing Types

```ballerina
// CHANGE: Add completion metadata to HumanTaskInfo
public type HumanTaskInfo record {|
    // ...existing fields
    string? completedBy;        // NEW
    string? completedAt;        // NEW
    json? result;               // NEW
    FailureInfo? failure;       // NEW
|};

// CHANGE: Add completion metadata to RetryTaskInfo
public type RetryTaskInfo record {|
    // ...existing fields
    string? decidedBy;          // NEW
    string? decidedAt;          // NEW
|};

// CHANGE: Add parent workflow type to summaries
public type HumanTaskSummary record {|
    // ...existing fields
    string? parentWorkflowType; // NEW
    boolean canComplete;        // NEW (based on user roles)
|};
```

---

## Implementation Roadmap

> **Detailed implementation plan:** See [management-api-implementation-plan.md](../../docs/management-api-implementation-plan.md)

### Phase 1: Core HTTP Service ✅ Complete

**Goal:** Implement HTTP service layer with basic workflow and task operations.

**Deliverables:**
- [x] HTTP service infrastructure (built-in listener at port 7234, base path `/workflow`)
- [x] Authentication/authorization middleware (Basic Auth, JWT, OAuth2, API key via `ManagementGatewayInterceptor`)
- [x] Workflow instance listing with pagination
- [x] Workflow lifecycle operations (start, suspend, resume, terminate, cancel)
- [x] Human task operations (list, get, complete, fail, cancel) with pagination
- [x] Retry task operations (list, get, retry, retry-with-input, fail) with pagination — response now returns `{success, decision, decidedBy, decidedAt}`
- [x] Error handling and standardized responses
- [x] CORS configuration

**Mock UI Changes:**
- [ ] Remove Express backend
- [ ] Implement direct API calls from React frontend
- [ ] Add authentication header injection
- [ ] Implement pagination controls
- [ ] Update all pages to use new endpoints (`http://localhost:7234/workflow/...`)

### Phase 2: Enhanced Metadata & Search (Weeks 4-5)

**Goal:** Add completion tracking and advanced query capabilities.

**Deliverables:**
- [x] Completion metadata tracking (`completedBy`, `completedAt` on human tasks; `decidedBy`, `decidedAt`, `decision` on retry tasks)
- [ ] Temporal search attributes registration
- [x] Advanced query filters (parent workflow type, user role, `onlyMyTasks`)
- [x] "My Tasks" filtering (`onlyMyTasks` query param on `GET /human-tasks`)
- [x] Pending task count endpoint (`GET /human-tasks/pending-count`)
- [ ] Time-based query filters (`startTimeFrom`, `startTimeTo`, `closeTimeFrom`, `closeTimeTo`) — **not yet implemented**
- [ ] Audit trail queries

**Mock UI Changes:**
- [ ] Display "Completed by" / "Decided by" in task lists
- [ ] Add "My Tasks" filter
- [ ] Add workflow definition dropdown filters
- [ ] Show pending task count badge

### Phase 3: Execution Visualization ✅ Complete

**Goal:** Provide workflow execution visualization.

**Deliverables:**
- [x] History event fetching (`GET /workflows/:id/:run/history`)
- [x] Activity tree parser (`GET /workflows/:id/:run/activity-tree`)
- [x] Execution graph builder (`GET /workflows/:id/:run/execution-graph`)
- [x] HTTP endpoints for visualization APIs

**Mock UI Changes:**
- [ ] Activity tree view component
- [ ] Execution graph visualization (D3.js/React Flow)
- [ ] History timeline component
- [ ] Detailed activity inspector

---

## Current Status

**Management API (Ballerina `workflow.management` HTTP service):**
- ✅ All endpoints implemented — see `service.bal`
- ✅ Authentication: Basic Auth, JWT, OAuth2, API key
- ✅ CORS configurable
- ✅ Human task operations (list, detail, complete, fail, cancel)
- ✅ Retry task operations (list, detail, retry, retry-with-input, fail) — returns `{success, decision, decidedBy, decidedAt}`
- ✅ Execution visualization (history, activity tree, execution graph)
- ❌ Time-based query filters (`startTimeFrom`, `startTimeTo`, etc.) — not yet implemented

**Frontend (React):**
- ✅ Definitions page
- ✅ Search/browse workflows pages
- ✅ Workflow detail page
- ✅ Human tasks list and detail
- ✅ Basic pagination controls
- ❌ Review failures (retry tasks) pages
- ❌ Activity tree visualization
- ❌ Execution graph visualization

**Backend (Express):**
- ⚠️ **TO BE REMOVED** — Frontend will call Management API directly (`http://localhost:7234/workflow/`)
- Current backend uses direct Temporal client
- Will be replaced by the built-in Management API HTTP service

**Migration Steps:**
1. ✅ Implement Management API HTTP service
2. Update frontend to call Management API directly at `http://localhost:7234/workflow/`
3. Remove Express backend
4. Deploy Management API alongside Ballerina workflow integration

---

## Authorization Model

### Operation-Level Authorization

| Operation | Required Roles | Notes |
|-----------|----------------|-------|
| View workflows | Any authenticated user | Read-only |
| Start workflow | Any authenticated user | Logged via `x-user-id` |
| Suspend/Resume | Any authenticated user | Audit logged |
| Terminate workflow | `admin` | Admin-only operation |
| Cancel workflow | Any authenticated user | Audit logged |
| View human tasks | Any authenticated user | Read-only |
| Complete human task | User roles must overlap with task's `userRoles` | Role validation enforced |
| Fail human task | User roles must overlap with task's `userRoles` | Role validation enforced |
| View retry tasks | Any authenticated user | Read-only |
| Retry decisions | `admin` or task-specific roles | Role validation enforced |

### Audit Trail

All mutations record:
- `userId` from `x-user-id` header
- `timestamp`
- `action` type
- `roles` from `x-user-roles`

Stored in:
- Temporal workflow memo (immutable)
- Application logs
- Optional: Separate audit database

---

## Success Criteria

- ✅ Frontend calls Management API directly (zero backend proxy code)
- ✅ All UI features work via Management API
- ✅ All list operations support pagination
- ✅ P95 latency < 200ms for list operations
- ✅ P95 latency < 100ms for detail operations
- ✅ Role-based authorization enforced
- ✅ Complete audit trail for all mutations
- ✅ 100% test coverage for HTTP service layer
