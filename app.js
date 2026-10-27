// Static storyboard: one leave-approval instance seen from the ICP, the admin context and the user inbox.
// No backend. The scenario state below is the only thing that changes while you click through.

const state = {
  reassigned: false, // step 3: the admin moves the task from the manager on leave to the delegate
  approved: false, // step 4: the delegate approves it from the inbox
};

const INSTANCE = {
  id: "LR-2026-1042",
  type: "Leave request",
  requester: "Priya Fernando",
  manager: "Ravi Perera",
  delegate: "Nadia Silva",
  leave: "Annual leave, 3–7 Nov 2026 (5 days), balance 12 days",
  waitingDays: 6,
};

const PORTALS = {
  admin: "https://workflow-prod.example.com/admin",
  inbox: "https://workflow-prod.example.com/inbox",
};

const assignee = () => (state.reassigned ? INSTANCE.delegate : `${INSTANCE.manager} (on leave)`);
const status = () => (state.approved ? "Completed" : "Waiting for approval");
const statusPill = () => (state.approved ? `<span class="pill ok">Completed</span>` : `<span class="pill wait">Waiting ${INSTANCE.waitingDays} d</span>`);

// ---------------------------------------------------------------- building blocks

function frame(url, persona, body, side) {
  return `<div class="frame">
    <div class="chrome"><span class="dots"></span><span class="url">${url}</span><span class="persona">${persona}</span></div>
    <div class="screen${side ? "" : " no-side"}">${side ? `<aside class="side">${side}</aside>` : ""}<div class="body">${body}</div></div>
  </div>`;
}

function sideNav(groups) {
  return groups
    .map(([label, items]) => `<div class="label">${label}</div>` + items.map((i) =>
      `<div class="item${i.on ? " on" : ""}">${i.name}${i.badge ? `<span class="badge">${i.badge}</span>` : ""}</div>`).join(""))
    .join("");
}

function notes(list) {
  return `<div class="notes">${list.map(([title, text, kind]) => `<div class="note${kind ? " " + kind : ""}"><b>${title}</b>${text}</div>`).join("")}</div>`;
}

function intro(title, lead, facts) {
  return `<div class="intro"><div><h1>${title}</h1><p>${lead}</p></div>
    <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></div>`;
}

const hl = (id) => (scenario.active && scenario.steps[scenario.index].highlight === id ? " hl" : "");


// Runtime versions differ per environment, so the portal UI and API version differ too; the ICP only stores the link.
const ENVS = [
  { env: "dev", status: "1/1 Online", runtime: "0.3.0-dev", api: "v2", db: "SQLite", nodes: 1, running: 6, waiting: 2, failed: 1 },
  { env: "staging", status: "1/1 Online", runtime: "0.2.0", api: "v2", db: "PostgreSQL", nodes: 1, running: 23, waiting: 7, failed: 0 },
  { env: "prod", status: "2/2 Online", runtime: "0.1.0", api: "v1", db: "PostgreSQL", nodes: 2, running: 128, waiting: 41, failed: 3 },
];
const portalUrl = (env, ctx) => `https://workflow-${env}.example.com/${ctx}`;

function icpFrame(url, persona, nav, body) {
  const head = `<div class="icp-head"><span>☰</span><span class="logo">WSO2 <b>Integration</b> Platform</span>
    <span class="sw">Default Organization<small>Organization</small></span><span>›</span><span class="sw">HR<small>Project</small></span><span>›</span><span class="sw">hr-leave-approval<small>Integration</small></span>
    <span class="sp"></span><span class="ic bell"></span><span class="ic user"></span></div>`;
  const side = sideNav([
    ["", [{ name: "Overview" }, { name: nav.workflows || "Workflows", on: nav.on === "workflows" }, { name: "Runtimes", on: nav.on === "runtimes" }]],
    ["Observability", [{ name: "Logs" }, { name: "Loggers" }, { name: "Metrics" }]],
    ["Infrastructure", [{ name: "Environments" }]],
    ["Management", [{ name: "Access-control" }]],
  ]);
  return `<div class="frame icp">
    <div class="chrome"><span class="dots"></span><span class="url">${url}</span><span class="persona">${persona}</span></div>
    <div class="screen">${head}<div class="icp-main"><aside class="side">${side}</aside><div class="body">${body}</div></div>
    <div class="foot">Privacy Policy · Cookie Policy · Support · v2.2 · © 2026 WSO2 LLC.</div></div>
  </div>`;
}

// ---------------------------------------------------------------- screens

function overview() {
  return `
  <section class="hero">
    <h1>Where do the workflow portals live?</h1>
    <p>The workflow runtime ships two business-facing contexts, an <b>admin context</b> and a <b>user inbox</b>.
    Technically they could be bolted onto the Integration Control Plane. This storyboard shows the same leave-request
    instance from each surface so the reason they are separate is visible rather than argued.</p>
    <p><button class="btn primary" onclick="scenario.start()">Walk the scenario</button>
    <span class="scale">five steps, one stuck instance, three surfaces</span></p>
  </section>
  <div class="trio">
    <a href="#/icp"><div class="card"><h3>Integration Control Plane <span class="who">DevOps</span></h3>
      <div>All environments of every integration. Sees the runtime as a <i>component</i>: version, health, scaling, logs,
      namespaces, and links to the portals of each environment.</div>
      <ul><li>dev · staging · prod in one view</li><li>register runtimes, create namespaces, scale, alert</li></ul>
      <span class="scale">Sized for a handful of operators, 1–2 nodes</span></div></a>
    <a href="#/admin"><div class="card"><h3>Admin context <span class="who">Business operations</span></h3>
      <div>One environment, one runtime. Instances, tasks and definitions of the workflows running there.</div>
      <ul><li>reassign a task, pause, resume, terminate</li><li>retry a failed step, audit who did what</li></ul>
      <span class="scale">Scales with the number of running workflows</span></div></a>
    <a href="#/inbox"><div class="card"><h3>User inbox <span class="who">Business users</span></h3>
      <div>One environment. The tasks waiting for <i>me</i>, with the form to complete them, plus notifications.</div>
      <ul><li>approve, reject, request changes</li><li>optionally start a request</li></ul>
      <span class="scale">Scales with the number of people in the business</span></div></a>
  </div>
  ${notes([
    ["Environment is the dividing line", "The ICP spans environments. A manager's approvals exist only in production; a merged inbox would have to ask which environment it is showing."],
    ["Different persona, different questions", "DevOps asks “is it healthy, what version, how many pods”. Business asks “why is Priya's request stuck, who can approve it”."],
    ["Different scaling", "The ICP is sized for operators. The inbox is sized for everyone with a task in the business, and grows with the load of the workflows."],
    ["Different versions", "Each environment runs its own runtime version. A portal served by the runtime matches it; a portal compiled into the ICP must carry every version at once."],
  ])}
  <p>See <a href="#/why">Why</a> for the full comparison, <a href="#/wrong">Today</a> for the Workflows page the ICP ships now,
  and <a href="#/custom">Own portal</a> for teams that want to build their own UI on the same APIs.</p>`;
}

function icp() {
  const cards = ENVS.map((e) => `<div class="panel env-card${e.env === "prod" ? hl("icp-portals") : ""}">
      <div class="h"><b>${e.env}</b><span class="chip online">${e.status}</span><span class="chip wf">Workflow runtime <span class="ver">${e.runtime}</span></span><span class="sp" style="flex:1"></span>
        <button class="btn small">Logs</button><button class="btn small">Scale</button></div>
      <div><h4>Runtime (DevOps)</h4><dl class="kv" style="grid-template-columns:80px 1fr"><dt>Nodes</dt><dd>${e.nodes}</dd><dt>Database</dt><dd>${e.db}</dd><dt>Namespaces</dt><dd>hr, hr-archive</dd></dl>
        <div class="actions"><button class="btn small">Create namespace</button><button class="btn small">Register runtime</button></div></div>
      <div><h4>Workflow portals · API ${e.api}</h4><div class="links"><a href="#/admin">${portalUrl(e.env, "admin")}</a><a href="#/inbox">${portalUrl(e.env, "inbox")}</a></div>
        <p class="crumb" style="font-size:12px">Served by this runtime, so always the matching version.</p></div>
      <div><h4>Counters (read-only)</h4><dl class="kv" style="grid-template-columns:110px 1fr"><dt>Running</dt><dd>${e.running}</dd><dt>Waiting on people</dt><dd>${e.waiting}</dd><dt>Failed, 24 h</dt><dd>${e.failed}</dd></dl></div>
    </div>`).join("");
  const body = `
    <div class="bar"><span class="avatar">H</span><div><h2 style="margin:0">hr-leave-approval</h2><span class="crumb">Leave requests and approvals for the HR project</span></div></div>
    <div class="tabs-ul"><span>Overview</span><span class="on">Workflow runtime</span><span>Runtimes</span></div>
    <div class="env-cards">${cards}</div>`;
  return intro("Integration Control Plane", "What DevOps sees, in the ICP's own shape: one card per environment. The runtime is a component with a version, nodes, a database and namespaces; the workflow functions are links to that environment's runtime.",
    [["Persona", "Platform / DevOps"], ["Scope", "All environments of the integration"], ["Stays here", "Environments, runtime registration, namespaces, scaling, logs, metrics, access control"], ["Moves out", "Instances, tasks, approvals, retries"]])
    + icpFrame("https://icp.example.internal/organizations/default/projects/hr/components/hr-leave-approval/workflow-runtime", "Signed in: ops-team", { on: "workflows", workflows: "Workflow runtime" }, body)
    + notes([
      ["DevOps functions stay in the ICP", "Create namespaces, register a runtime, bind it to an environment, scale it, read its logs and metrics, manage who may operate it. These are the ICP's job."],
      ["Workflow functions come from the runtime's URL", "Three environments run three runtime versions (0.1.0, 0.2.0, 0.3.0-dev) with two portal API versions. A link is always version-matched; a UI compiled into the ICP would have to speak all of them."],
      ["Counts, not cases", "Aggregates are fine here. The moment you need a row per instance or a form per task, you are in the other persona's tool."],
    ]);
}

function admin(detail) {
  const side = sideNav([
    ["Workflow admin · prod", [{ name: "Overview" }, { name: "Instances", on: true, badge: "128" }, { name: "Tasks", badge: "41" }, { name: "Definitions" }, { name: "Audit" }]],
  ]);
  const rows = [
    [INSTANCE.id, INSTANCE.type, INSTANCE.requester, statusPill(), assignee(), true],
    ["LR-2026-1051", "Leave request", "Kasun Jay", `<span class="pill ok">Running</span>`, "—"],
    ["LR-2026-1037", "Leave request", "Mei Lin", `<span class="pill ok">Completed</span>`, "—"],
    ["LR-2026-1029", "Leave request", "Tom Baker", `<span class="pill bad">Failed · notify-payroll</span>`, "—"],
    ["OB-2026-0311", "Onboarding", "Sara Khan", `<span class="pill wait">Waiting 1 d</span>`, "IT desk"],
  ];
  const list = `
    <div class="bar"><h2>Instances</h2><span class="chips"><span class="chip on">All</span><span class="chip">Waiting</span><span class="chip">Failed</span><span class="chip">Completed</span></span>
      <span class="crumb">environment: <code>prod</code> only</span></div>
    <table><tr><th>Instance</th><th>Workflow</th><th>Requester</th><th>Status</th><th>Assigned to</th><th></th></tr>
      ${rows.map(([id, t, r, s, a, main]) => `<tr class="link${main ? hl("admin-row") : ""}" onclick="location.hash='#/admin/instance'"><td><code>${id}</code></td><td>${t}</td><td>${r}</td><td>${s}</td><td>${a}</td><td>${main ? "<button class='btn small'>Open</button>" : ""}</td></tr>`).join("")}
    </table>`;
  const steps = `
    <ul class="steps">
      <li class="done"><span class="t">Submitted</span><span class="d">${INSTANCE.requester}, 21 Oct</span></li>
      <li class="done"><span class="t">Validate leave policy</span><span class="d">activity, 0.2 s</span></li>
      <li class="${state.approved ? "done" : "now"}"><span class="t">Manager approval</span><span class="d">task · assigned to ${assignee()}${state.approved ? " · approved" : ` · waiting ${INSTANCE.waitingDays} d`}</span></li>
      <li class="${state.approved ? "done" : ""}"><span class="t">Notify HR &amp; payroll</span><span class="d">activity</span></li>
      <li class="${state.approved ? "done" : ""}"><span class="t">Done</span></li>
    </ul>`;
  const reassign = state.reassigned
    ? `<p class="pill ok">Reassigned to ${INSTANCE.delegate}</p>`
    : `<div class="panel${hl("admin-reassign")}"><h3>Reassign task “Manager approval”</h3>
        <div class="form"><label>From</label><div class="in">${INSTANCE.manager} (on leave until 10 Nov)</div>
        <label>To</label><div class="in">${INSTANCE.delegate} · delegate for ${INSTANCE.manager}</div>
        <label>Reason (audited)</label><div class="in ta">Manager on leave, request older than 5 days</div></div>
        <div class="actions"><button class="btn primary" onclick="state.reassigned=true;render()">Reassign</button><button class="btn">Cancel</button></div></div>`;
  const detailBody = `
    <div class="bar"><span class="crumb">Instances ›</span><h2><code>${INSTANCE.id}</code> ${INSTANCE.type}</h2>${statusPill()}</div>
    <div class="two">
      <div class="panel"><h3>Progress</h3>${steps}
        <div class="actions"><button class="btn small">Pause</button><button class="btn small" disabled>Resume</button><button class="btn small">Terminate</button><button class="btn small" disabled>Retry step</button></div></div>
      <div>
        <div class="panel"><h3>Request</h3><dl class="kv"><dt>Requester</dt><dd>${INSTANCE.requester}</dd><dt>Leave</dt><dd>${INSTANCE.leave}</dd><dt>Waiting on</dt><dd>${assignee()}</dd></dl></div>
        ${reassign}
        <div class="panel"><h3>Audit</h3><dl class="kv"><dt>21 Oct 09:12</dt><dd>started by ${INSTANCE.requester}</dd>
          ${state.reassigned ? `<dt>27 Oct 10:04</dt><dd>task reassigned ${INSTANCE.manager} → ${INSTANCE.delegate} by ops-admin</dd>` : ""}
          ${state.approved ? `<dt>27 Oct 10:09</dt><dd>approved by ${INSTANCE.delegate}</dd>` : ""}</dl></div>
      </div>
    </div>`;
  return intro("Admin context", "What business operations see: every instance of this environment, why it is stuck, and the levers to unstick it. Same deployable as the inbox, different context and role.",
    [["Persona", "Business administrator"], ["Scope", "One environment, one runtime"], ["Scaling", "With the number of workflow instances"], ["Actions", "Reassign, pause, resume, terminate, retry"]])
    + frame(`${PORTALS.admin}${detail ? "/instances/" + INSTANCE.id : "/instances"}`, "Signed in: ops-admin (role: workflow-admin)", detail ? detailBody : list, side)
    + notes([
      ["Business administration, not DevOps", "Reassigning an approval is an HR operations decision. It needs the request's content and an audit trail, not pod counts."],
      ["One environment on purpose", "The URL names the environment. There is no environment selector, because a stuck production request has no dev counterpart."],
    ]);
}

function inbox(task) {
  const mine = state.reassigned && !state.approved;
  const side = sideNav([
    ["My work", [{ name: "Inbox", on: true, badge: mine ? "1" : "" }, { name: "Done" }, { name: "Notifications", badge: state.reassigned ? "1" : "" }, { name: "New request" }]],
  ]);
  const list = mine
    ? `<div class="bar"><h2>Inbox</h2><span class="crumb">1 task</span></div>
      <table><tr><th>Task</th><th>From</th><th>Received</th><th></th></tr>
        <tr class="link${hl("inbox-row")}" onclick="location.hash='#/inbox/task'"><td>Approve leave request</td><td>${INSTANCE.requester}</td><td>just now · reassigned from ${INSTANCE.manager}</td><td><button class="btn small">Open</button></td></tr>
      </table>`
    : `<div class="bar"><h2>Inbox</h2></div>
      <div class="empty">${state.approved ? "Nothing waiting. The leave request is in <b>Done</b>." : `Nothing waiting for ${INSTANCE.delegate}.<br>The leave request is still assigned to ${INSTANCE.manager}, who is on leave. Reassign it in the <a href="#/admin/instance">admin context</a>.`}</div>`;
  const form = `
    <div class="bar"><span class="crumb">Inbox ›</span><h2>Approve leave request</h2></div>
    <div class="two">
      <div class="panel${hl("inbox-form")}"><dl class="kv"><dt>Requester</dt><dd>${INSTANCE.requester}</dd><dt>Leave</dt><dd>${INSTANCE.leave}</dd><dt>Team cover</dt><dd>Kasun Jay confirmed</dd></dl>
        <div class="form" style="margin-top:.6rem"><label>Comment</label><div class="in ta">Approved on behalf of ${INSTANCE.manager}.</div></div>
        <div class="actions">${state.approved ? `<span class="pill ok">Approved</span>` : `<button class="btn primary" onclick="state.approved=true;render()">Approve</button><button class="btn">Reject</button><button class="btn">Request changes</button>`}</div></div>
      <div class="panel"><h3>About this task</h3><p class="crumb">Reassigned to you from ${INSTANCE.manager} by ops-admin. Due in 2 days.</p>
        <p class="crumb">You see this task, its form and its outcome. You do not see the workflow instance, other people's tasks or the environment.</p></div>
    </div>`;
  return intro("User inbox", "What a business user sees: the tasks waiting for them, the form to complete each one, and notifications. Nothing about instances, versions or environments.",
    [["Persona", "Business user"], ["Scope", "My tasks, one environment"], ["Scaling", "With the number of people in the business"], ["Actions", "Complete a task, optionally start a request"]])
    + frame(`${PORTALS.inbox}${task ? "/tasks/t-7f3a" : ""}`, `Signed in: ${INSTANCE.delegate} (role: employee, manager)`, task ? form : list, side)
    + notes([
      ["An inbox, not a console", "Approvers are the widest audience of all. Their tool must be simple, mobile-friendly and sized for everyone, not for operators."],
      ["Same backend as the admin context", "Both contexts call the runtime's APIs of this environment with the caller's identity; the role decides which context opens."],
    ]);
}

function custom() {
  const body = `
    <div class="bar"><h2>HR self-service</h2><span class="chips"><span class="chip on">Home</span><span class="chip">Payslips</span><span class="chip">Leave</span><span class="chip">Directory</span></span></div>
    <div class="two">
      <div class="panel hl-box"><h3>My approvals (${state.reassigned && !state.approved ? 1 : 0})</h3>
        ${state.reassigned && !state.approved ? `<p>${INSTANCE.requester} · annual leave · 5 days <button class="btn small primary">Approve</button> <button class="btn small">Reject</button></p>` : `<p class="crumb">Nothing waiting.</p>`}
        <p class="crumb">Widget backed by <code>GET /tasks?assignee=me</code> of the prod runtime</p></div>
      <div class="panel"><h3>Announcements</h3><p class="crumb">Office closed 4 Nov · New parking policy · …</p></div>
    </div>`;
  const apis = `
    <div class="panel"><h3>The APIs the shipped portals use (one environment)</h3>
      <div class="links"><a>GET  /tasks?assignee=me</a><a>POST /tasks/{id}/complete</a><a>GET  /instances?status=waiting</a><a>POST /instances/{id}/tasks/{task}/reassign</a><a>POST /instances/{id}/pause · /resume · /terminate</a><a>GET  /instances/{id}/audit</a></div></div>`;
  return intro("Bring your own portal", "The counter-argument to two contexts is “customers will build their own portal anyway”. That is the point: the APIs are the product, the shipped admin context and inbox are their reference consumers.",
    [["Persona", "A customer's own users"], ["Scope", "Whatever their app covers, one environment"], ["Built on", "The same runtime APIs"], ["Shipped portals", "Optional"]])
    + frame("https://people.example.com/", `Signed in: ${INSTANCE.delegate}`, body)
    + apis
    + notes([
      ["Same APIs, different UX", "A team that wants approvals inside their HR app embeds a widget against the task API and never opens the shipped inbox."],
      ["Why this argues for separation", "An API consumed by a customer's app in production is an environment-scoped, business-facing contract. Nothing about it belongs to the control plane."],
    ]);
}

function wrong() {
  const body = `
    <div class="bar"><h2 style="margin:0">Workflows</h2><span class="sp" style="flex:1"></span><span class="ac">prod <small>Environment ▾</small></span></div>
    <p class="crumb">Manage workflow executions and human tasks for <b>hr-leave-approval</b>.</p>
    <div class="tabs-ul"><span class="on">User Actions</span><span>Admin Actions</span></div>
    <div class="bar"><span class="toggle"><span class="on">My Tasks</span><span>History</span></span><span class="chip">3 pending</span><span class="crumb">signed in as ${INSTANCE.delegate}</span></div>
    <table><tr><th>Task</th><th>Workflow Name</th><th>Status</th><th>Started</th><th></th></tr>
      <tr><td>Approve leave request · ${INSTANCE.requester}</td><td>Leave request</td><td><span class="pill wait">Pending</span></td><td>21 Oct</td><td><button class="btn small">Open</button></td></tr>
      <tr><td>Approve leave request · Kasun Jay</td><td>Leave request</td><td><span class="pill wait">Pending</span></td><td>25 Oct</td><td><button class="btn small">Open</button></td></tr>
      <tr><td>Confirm equipment · Sara Khan</td><td>Onboarding</td><td><span class="pill wait">Pending</span></td><td>26 Oct</td><td><button class="btn small">Open</button></td></tr>
    </table>
    <div class="panel" style="margin-top:.8rem"><h3>Admin Actions (other tab)</h3><p class="crumb">Workflows · Retry Tasks · Status filter · Start Workflow · Workflow ID, Name, Status, Started, Actions · detail drawer: Info | History | Execution Graph</p></div>`;
  return intro("Today: the Workflows page inside the ICP", "This is what the ICP ships now, drawn in its own theme: a Workflows page per integration with an environment picker and User Actions / Admin Actions tabs. It works, and it is the page people point at when they ask for “all the portals in the ICP”.",
    [["Persona", "Everyone, in the DevOps console"], ["Scope", "One environment at a time, chosen on the page"], ["Scaling", "Every approver on a 1–2 node console"], ["Proposal", "Keep the DevOps page; move these two tabs to the runtime URL"]])
    + icpFrame("https://icp.example.internal/organizations/default/projects/hr/components/hr-leave-approval/workflows", `Signed in: ${INSTANCE.delegate} · also sees Runtimes, Logs, Environments`, { on: "workflows" }, body)
    + notes([
      ["Environment picker on a business page", "Nadia has to know what “staging” and “dev” mean to find her real approval. Her inbox is a production thing; the picker exists only because the ICP spans environments.", "bad"],
      ["Wrong audience on the wrong box", "Every manager in the company gets an ICP account. The ICP is sized for a few operators; scaling it for approvers scales the wrong thing.", "bad"],
      ["One page, several runtime versions", "This page is compiled into the ICP. prod runs portal API v1 and staging v2, so the page has to carry both versions' business logic, and every runtime release becomes an ICP release.", "bad"],
      ["Wrong neighbours", "“Approve leave” sits beside Runtimes, Environments and Access-control: a persona mismatch and an access-control problem.", "bad"],
    ]);
}

function why() {
  return `
  <h1>Why the portals are not part of the ICP</h1>
  <p class="hero">Four reasons, in the order that ends the discussion fastest.</p>
  <div class="notes">
    <div class="note"><b>1. Environment</b>The ICP is multi-environment by design. The admin context and the inbox are single-environment by definition: a production approval has no dev or staging counterpart. There is no coherent “all environments” inbox, so the merged feature has no definition, only a filter that re-creates the split.</div>
    <div class="note"><b>2. Persona</b>The ICP serves DevOps: versions, health, scaling, deployments. The admin context serves business operations: reassign, pause, resume, terminate, retry, audit. The inbox serves every business user: my tasks and their forms. Different questions, different UX, different access control.</div>
    <div class="note"><b>3. Scaling</b>The ICP is sized for a few operators on one or two nodes. The portals scale with the workflow load and with the number of people in the business. Putting them in the ICP means scaling the control plane for business traffic.</div>
    <div class="note"><b>4. Versioning</b>Each environment runs its own runtime version, so each has its own portal UI and API version. A portal served by the runtime is always version-matched. A portal compiled into the ICP has to carry every version's business logic at once, and every runtime release becomes an ICP release.</div>
  </div>
  <h2>What stays in the ICP, what comes from the runtime URL</h2>
  <div class="panel"><table class="compare">
    <tr><th>Stays in the ICP (DevOps)</th><th>Comes from the runtime of each environment (workflow)</th></tr>
    <tr><td>Environments and the runtime bound to each</td><td>Instances: list, detail, pause, resume, terminate</td></tr>
    <tr><td>Register a runtime, create namespaces</td><td>Tasks: reassign, retry a failed step, fail permanently</td></tr>
    <tr><td>Scale, logs, loggers, metrics</td><td>Inbox: my tasks, forms, notifications, start a request</td></tr>
    <tr><td>Access control for operators</td><td>Audit of business actions</td></tr>
    <tr><td>Aggregate counters and links to the portals</td><td>Definitions and the version they run at</td></tr>
  </table></div>
  <h2>Side by side</h2>
  <div class="panel"><table class="compare">
    <tr><th></th><th>ICP</th><th>Admin context</th><th>User inbox</th></tr>
    <tr><td>Persona</td><td>DevOps, platform</td><td>Business administrator</td><td>Business user</td></tr>
    <tr><td>Scope</td><td>All integrations, all environments</td><td>One environment, one runtime</td><td>My tasks in one environment</td></tr>
    <tr><td>Questions</td><td>Healthy? Which version? How many pods?</td><td>Why is it stuck? Who can unblock it?</td><td>What is waiting for me?</td></tr>
    <tr><td>Actions</td><td>Deploy, roll back, scale, alert</td><td>Reassign, pause, resume, terminate, retry</td><td>Approve, reject, request changes, start</td></tr>
    <tr><td>Sees the runtime as</td><td>A component with health and links to the portals</td><td>Instances, tasks, definitions, audit</td><td>Tasks and forms</td></tr>
    <tr><td>Scaling</td><td>1–2 nodes, a few operators</td><td>With running workflows</td><td>With people in the business</td></tr>
    <tr><td>Identity</td><td>Platform accounts</td><td colspan="2">The customer's IdP; role decides which context opens</td></tr>
  </table></div>
  <h2>Answers to the usual follow-ups</h2>
  <div class="panel">
    <p><b>Can the admin context and the inbox be one thing?</b> They are one deployable with two contexts (<code>/admin</code> and <code>/inbox</code>) on the same APIs; the role decides which context a user gets. Two contexts, not two products.</p>
    <p><b>Customers will build their own portal.</b> Yes, on the same APIs, which is why the APIs are the product and the shipped portals are reference consumers (see <a href="#/custom">Own portal</a>). That is an argument for environment-scoped, business-facing APIs, not for folding the UI into the control plane.</p>
    <p><b>Is the admin context the ICP admin?</b> No. “Admin” here means business administration of workflows: reassigning tasks, pausing and resuming instances. The ICP's administrator manages the platform.</p>
    <p><b>How does the ICP relate to the portals then?</b> When a runtime connects, the ICP learns its portals and shows them per environment, next to the runtime's version, health and aggregate metrics (see <a href="#/icp">ICP</a>). It links out; it does not host them.</p>
    <p><b>Should it be under Runtimes, like MI?</b> Registration, health and logs yes; the per-integration binding with namespaces, portals and counters needs its own item. See <a href="#/placement">Placement</a> for both drawn with pros and cons.</p>
    <p><b>The ICP already has a Workflows page with User and Admin tabs.</b> Yes (see <a href="#/wrong">Today</a>). The proposal keeps that page's DevOps half, the runtime and its environments, and moves the two business tabs behind the runtime's own URL, one per environment and version.</p>
  </div>`;
}


function placement() {
  const rows = (env) => [
    ["hr-leave-approval-1", "BI", "RUNNING", "1.3.0", "", false],
    ["hr-leave-approval-2", "BI", "RUNNING", "1.3.0", "", false],
    [`workflow-rt-${env}`, "Workflow", "RUNNING", env === "prod" ? "0.1.0" : "0.2.0", `<a href="#/admin">admin</a> · <a href="#/inbox">inbox</a>`, true],
  ];
  const table = (env) => `<div class="panel"><div class="h" style="display:flex;gap:.5rem;align-items:center;margin-bottom:.4rem"><b style="font-size:16px">${env}</b><span class="chip on">3 runtimes</span><span style="flex:1"></span><button class="btn small primary">+ Register runtime</button></div>
    <table><tr><th>Runtime</th><th>Type</th><th>Status</th><th>Version</th><th>Portals</th><th></th></tr>
    ${rows(env).map(([id, t, s, v, p, wf]) => `<tr${wf ? ' class="hl-box"' : ""}><td><code>${id}</code></td><td><span class="chip${wf ? " wf" : ""}">${t}</span></td><td><span class="pill ok">${s}</span></td><td class="ver">${v}</td><td style="white-space:nowrap">${p}</td><td><button class="btn small">Logs</button> <button class="btn small">Delete</button></td></tr>`).join("")}
    </table></div>`;
  const optionA = `
    <div class="bar"><h2 style="margin:0">Runtimes</h2></div>
    <div class="env-cards">${table("prod")}${table("staging")}</div>
    <div class="panel"><h3>Register runtime</h3><div class="tabs-ul"><span>Default</span><span>MI</span><span class="on">Workflow</span></div>
      <p class="crumb" style="font-size:12px">Add the following to the runtime's <b>runtime.toml</b>. The secret is shown once. Enable Workflow Management is implied.</p></div>`;
  const optionB = `
    <div class="bar"><span class="avatar">H</span><div><h2 style="margin:0">hr-leave-approval</h2><span class="crumb">Leave requests and approvals for the HR project</span></div></div>
    <div class="tabs-ul"><span>Overview</span><span class="on">Workflow runtime</span><span>Runtimes</span></div>
    <div class="panel env-card"><div class="h"><b>prod</b><span class="chip online">2/2 Online</span><span class="chip wf">Workflow runtime <span class="ver">0.1.0</span></span></div>
      <div><h4>Runtime (DevOps)</h4>nodes, database, namespaces</div><div><h4>Portals · API v1</h4><div class="links"><a href="#/admin">${portalUrl("prod", "admin")}</a><a href="#/inbox">${portalUrl("prod", "inbox")}</a></div></div><div><h4>Counters</h4>running, waiting, failed</div></div>
    <p class="crumb">Full version on the <a href="#/icp">ICP</a> page.</p>`;
  return `
  <h1>Where does the workflow runtime appear in the ICP?</h1>
  <p class="hero">The first question the ICP team will ask. Two candidate placements, drawn in the ICP's shape, with the case for each.</p>
  <div class="options">
    <div>
      <h2>A · Under <b>Runtimes</b>, as a runtime type</h2>
      ${icpFrame("https://icp.example.internal/organizations/default/projects/hr/components/hr-leave-approval/runtimes", "Signed in: ops-team", { on: "runtimes" }, optionA)}
      ${notes([
        ["For", "It is a registered process with a secret, a status, logs and metrics, exactly like a BI or MI runtime. The ICP already models MI, which the user does not write either, under Runtimes. One registration flow, one list, one log pipeline, no new navigation.", "ok"],
        ["Against", "Runtimes are per integration; the workflow runtime is per environment and shared by many integrations, so it would appear under every integration that uses it. Namespaces, portal links and workflow counters have no column in a runtime list.", "bad"],
      ])}
    </div>
    <div>
      <h2>B · Its own item, <b>Workflow runtime</b></h2>
      ${icpFrame("https://icp.example.internal/organizations/default/projects/hr/components/hr-leave-approval/workflow-runtime", "Signed in: ops-team", { on: "workflows", workflows: "Workflow runtime" }, optionB)}
      ${notes([
        ["For", "Room for what a runtime row cannot hold: namespaces, the portal links per environment and version, read-only workflow counters. The sidebar item already exists today as “Workflows”; this changes what it shows, not where it is. Says clearly: the user did not write this, it is infrastructure the integration uses.", "ok"],
        ["Against", "A second place that looks like a runtime list. If registration, health and logs are also done here, the ICP has two runtime models to keep consistent.", "bad"],
      ])}
    </div>
  </div>
  <h2>Side by side</h2>
  <div class="panel"><table class="compare">
    <tr><th></th><th>A · under Runtimes</th><th>B · own item</th></tr>
    <tr><td>Analogy</td><td>MI: a runtime the user did not write, registered like any other</td><td>Database or message broker: infrastructure the integration binds to</td></tr>
    <tr><td>Ownership</td><td>Looks per integration; the runtime is per environment</td><td>Per environment, shown from the integration that uses it</td></tr>
    <tr><td>Registration, secret, status, logs, metrics</td><td>Reused as is</td><td>Needs a copy, or a link to A</td></tr>
    <tr><td>Namespaces, portals, counters</td><td>No place for them</td><td>Native</td></tr>
    <tr><td>Navigation change</td><td>None; one more type chip and a third tab in Register</td><td>Rename today's “Workflows” item and replace its content</td></tr>
    <tr><td>Risk</td><td>The workflow runtime reads as one more pod of the integration</td><td>Two runtime-like lists</td></tr>
  </table></div>
  <h2>Recommendation</h2>
  <div class="panel">
    <p><b>Do both, split by job.</b> Register, monitor and log the workflow runtime under <b>Runtimes</b> as a third type next to BI and MI (option A): it is a process with a secret and a status, and the ICP already has that plumbing. Keep the integration-level <b>Workflow runtime</b> item (option B) for what a runtime row cannot show: which environment's runtime this integration is bound to, its namespaces, the version-matched portal links and the counters. The item links back to the runtime row for health and logs.</p>
    <p>The MI counter-argument is right about registration and wrong about the rest: MI runs the integration, so it belongs to the integration; the workflow runtime serves every integration in the environment, so its registration belongs to the environment and its appearance under an integration is a binding, not ownership.</p>
    <p class="crumb">If only one may be chosen: A. Nothing in B is lost for DevOps, and the portals are reachable from the runtime row.</p>
  </div>`;
}

// ---------------------------------------------------------------- scenario

const scenario = {
  active: false,
  index: 0,
  steps: [
    { route: "icp", highlight: "icp-portals", caption: `Ops checks hr-leave-approval in the ICP: prod is healthy on 1.3.0, oldest wait is ${INSTANCE.waitingDays} days. Nothing here names a request or a person; the portals are links.` },
    { route: "admin", highlight: "admin-row", caption: `The business administrator opens the prod admin context and finds ${INSTANCE.id}: ${INSTANCE.requester}'s leave request has waited ${INSTANCE.waitingDays} days on ${INSTANCE.manager}, who is on leave.` },
    { route: "admin/instance", highlight: "admin-reassign", caption: `Reassign the “Manager approval” task to ${INSTANCE.delegate}. Click Reassign; the reason is audited. This is a business operation, not a DevOps one.` },
    { route: "inbox", highlight: "inbox-row", caption: `${INSTANCE.delegate} opens the inbox (if the task is not there, go back and click Reassign). One task, one form, no instances, no environments.` },
    { route: "inbox/task", highlight: "inbox-form", caption: `Approve it. Then look at the admin context: the instance completes and the audit shows the reassignment; the ICP's counters move by one and still show nothing personal.` },
  ],
  start() { this.active = true; this.index = 0; this.go(); },
  go() {
    location.hash = "#/" + this.steps[this.index].route;
    render();
  },
  stop() { this.active = false; render(); },
};

function renderScenario() {
  const bar = document.getElementById("scenario");
  bar.hidden = !scenario.active;
  if (!scenario.active) return;
  const s = scenario.steps[scenario.index];
  document.getElementById("scenario-step").textContent = `Scenario · ${INSTANCE.id} · step ${scenario.index + 1} of ${scenario.steps.length}`;
  document.getElementById("scenario-caption").textContent = s.caption;
  document.getElementById("scenario-prev").disabled = scenario.index === 0;
  document.getElementById("scenario-next").textContent = scenario.index === scenario.steps.length - 1 ? "Finish" : "Next";
}

// ---------------------------------------------------------------- router

const routes = {
  "": overview,
  icp,
  admin: () => admin(false),
  "admin/instance": () => admin(true),
  inbox: () => inbox(false),
  "inbox/task": () => inbox(true),
  custom,
  wrong,
  placement,
  why,
};

function render() {
  const path = location.hash.replace(/^#\/?/, "");
  const page = routes[path] || overview;
  document.getElementById("view").innerHTML = page();
  const top = path.split("/")[0];
  document.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#/" + top));
  renderScenario();
  window.scrollTo(0, 0);
}

document.getElementById("scenario-toggle").addEventListener("click", () => scenario.start());
document.getElementById("scenario-close").addEventListener("click", () => scenario.stop());
document.getElementById("scenario-prev").addEventListener("click", () => { scenario.index = Math.max(0, scenario.index - 1); scenario.go(); });
document.getElementById("scenario-next").addEventListener("click", () => {
  if (scenario.index === scenario.steps.length - 1) { scenario.active = false; location.hash = "#/why"; render(); return; }
  scenario.index += 1;
  scenario.go();
});
window.addEventListener("hashchange", render);
render();
