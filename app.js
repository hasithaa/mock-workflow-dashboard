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
      and links to the portals of each environment.</div>
      <ul><li>dev · staging · prod in one view</li><li>deploy, roll back, scale, alert</li></ul>
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
  ])}
  <p>See <a href="#/why">Why</a> for the full comparison, <a href="#/wrong">Anti-pattern</a> for what the merged version would look like,
  and <a href="#/custom">Own portal</a> for teams that want to build their own UI on the same APIs.</p>`;
}

function icp() {
  const side = sideNav([
    ["Control plane", [{ name: "Overview" }, { name: "Integrations", on: true }, { name: "Environments" }, { name: "Deployments" }, { name: "Alerts", badge: "2" }, { name: "Settings" }]],
  ]);
  const body = `
    <div class="bar"><span class="crumb">Integrations ›</span><h2>hr-leave-approval</h2>
      <span class="chips"><span class="chip env">dev</span><span class="chip env">staging</span><span class="chip env on">prod</span></span></div>
    <div class="cards">
      <div class="card"><div class="k">Version</div><div class="v">1.3.0</div>staging has 1.4.0-rc1</div>
      <div class="card"><div class="k">Health</div><div class="v"><span class="pill ok">Healthy</span></div>2/2 replicas</div>
      <div class="card"><div class="k">Workflow runtime</div><div class="v">0.1.0</div>workflow-rt-prod · PostgreSQL</div>
      <div class="card"><div class="k">Last deployment</div><div class="v">3 d ago</div>by CI, pipeline #418</div>
    </div>
    <div class="two">
      <div class="panel${hl("icp-portals")}"><h3>Workflow portals (prod)</h3>
        <div class="links"><a href="#/admin">${PORTALS.admin}</a><a href="#/inbox">${PORTALS.inbox}</a></div>
        <p class="crumb">Registered when the runtime connected. Each environment has its own pair.</p></div>
      <div class="panel"><h3>Workflow metrics (prod, read-only)</h3>
        <dl class="kv"><dt>Running</dt><dd>128</dd><dt>Waiting on people</dt><dd>41</dd><dt>Failed, 24 h</dt><dd>3</dd><dt>Oldest wait</dt><dd>${INSTANCE.waitingDays} d · <a href="#/admin">open in admin</a></dd></dl></div>
    </div>
    <div class="panel"><h3>Environments</h3>
      <table><tr><th>Env</th><th>Version</th><th>Replicas</th><th>Runtime</th><th>Portals</th><th></th></tr>
        <tr><td>dev</td><td>1.4.0-dev</td><td>1</td><td>workflow-rt-dev · SQLite</td><td>admin · inbox</td><td><button class="btn small">Logs</button></td></tr>
        <tr><td>staging</td><td>1.4.0-rc1</td><td>1</td><td>workflow-rt-staging · PostgreSQL</td><td>admin · inbox</td><td><button class="btn small">Logs</button></td></tr>
        <tr><td>prod</td><td>1.3.0</td><td>2</td><td>workflow-rt-prod · PostgreSQL</td><td>admin · inbox</td><td><button class="btn small">Logs</button> <button class="btn small">Scale</button></td></tr>
      </table></div>`;
  return intro("Integration Control Plane", "What DevOps sees. The runtime is a component with a version and a health; the portals are links. Nothing here is about one request or one person.",
    [["Persona", "Platform / DevOps"], ["Scope", "All integrations, all environments"], ["Scaling", "1–2 nodes, a few operators"], ["Not here", "Instances, tasks, approvals"]])
    + frame("https://icp.example.internal/integrations/hr-leave-approval?env=prod", "Signed in: ops-team", body, side)
    + notes([
      ["Links out, does not host", "The ICP knows the portals exist and where. The admin context and inbox are served by the runtime of that environment."],
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
  const side = sideNav([
    ["Control plane", [{ name: "Overview" }, { name: "Integrations" }, { name: "Environments" }, { name: "Deployments" }, { name: "Alerts", badge: "2" }, { name: "Inbox", on: true, badge: "3" }, { name: "Settings" }]],
  ]);
  const body = `
    <div class="bar"><h2>Inbox</h2><span class="crumb">environment:</span><span class="chips"><span class="chip env on">all ▾</span></span><span class="crumb">signed in as ${INSTANCE.delegate}</span></div>
    <table><tr><th>Task</th><th>From</th><th>Integration</th><th>Env</th><th></th></tr>
      <tr><td>Approve leave request</td><td>${INSTANCE.requester}</td><td>hr-leave-approval</td><td><span class="pill bad">prod</span></td><td><button class="btn small">Open</button></td></tr>
      <tr><td>Approve leave request</td><td>test-user-7</td><td>hr-leave-approval</td><td><span class="pill dim">staging</span></td><td><button class="btn small">Open</button></td></tr>
      <tr><td>Approve leave request</td><td>priya.test</td><td>hr-leave-approval</td><td><span class="pill dim">dev</span></td><td><button class="btn small">Open</button></td></tr>
    </table>
    <div class="panel" style="margin-top:.8rem"><h3>Also on this page</h3><p class="crumb">Deployments · Roll back 1.3.0 → 1.2.4 · Scale replicas · Alert: CPU 91 % on workflow-rt-staging</p></div>`;
  return intro("Anti-pattern: the inbox inside the ICP", "What the request “put all the portals in the ICP” produces once it is drawn. It is technically possible and visibly wrong.",
    [["Persona", "Everyone at once"], ["Scope", "All environments, which is the problem"], ["Scaling", "Every approver on a 1–2 node console"], ["Verdict", "No"]])
    + frame("https://icp.example.internal/inbox", `Signed in: ${INSTANCE.delegate} · also sees deployments`, body, side)
    + notes([
      ["Which environment is this?", "A real approval sits next to two test ones from developers. The approver has to know what “staging” means. The answer “filter to prod” admits the inbox is per environment.", "bad"],
      ["Wrong audience on the wrong box", "Every manager in the company gets an account on the DevOps console, which is sized for a few operators. Scaling the ICP for approvers scales the wrong thing.", "bad"],
      ["Wrong neighbours", "“Approve leave” beside “roll back” and “scale replicas” is a persona mismatch and an access-control problem.", "bad"],
    ]);
}

function why() {
  return `
  <h1>Why the portals are not part of the ICP</h1>
  <p class="hero">Three reasons, in the order that ends the discussion fastest.</p>
  <div class="notes">
    <div class="note"><b>1. Environment</b>The ICP is multi-environment by design. The admin context and the inbox are single-environment by definition: a production approval has no dev or staging counterpart. There is no coherent “all environments” inbox, so the merged feature has no definition, only a filter that re-creates the split.</div>
    <div class="note"><b>2. Persona</b>The ICP serves DevOps: versions, health, scaling, deployments. The admin context serves business operations: reassign, pause, resume, terminate, retry, audit. The inbox serves every business user: my tasks and their forms. Different questions, different UX, different access control.</div>
    <div class="note"><b>3. Scaling</b>The ICP is sized for a few operators on one or two nodes. The portals scale with the workflow load and with the number of people in the business. Putting them in the ICP means scaling the control plane for business traffic.</div>
  </div>
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
