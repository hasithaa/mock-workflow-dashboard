// Central client for the Ballerina workflow.management HTTP service.
// Config is read from localStorage on every call — changes in ConfigBar take
// effect immediately without a page reload.
//
// Two independent concepts are stored:
//   1. CONNECTION  — base URL + authentication mode (none / basic / apikey)
//   2. MOCK USER   — x-user-id and x-user-roles headers (identity propagation)
//      These headers are always sent regardless of the auth mode.

const CONFIG_KEY     = 'wf-mgmt-config';
const USERS_KEY      = 'wf-mock-users';
const SELECTED_KEY   = 'wf-selected-user';
const RESTART_DRAFT_KEY = 'wf-restart-draft';

export const USER_CONTEXT_CHANGED_EVENT = 'wf:user-context-changed';

export function notifyUserContextChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(USER_CONTEXT_CHANGED_EVENT));
  }
}

// ── Default mock users ────────────────────────────────────────────────────────
export const DEFAULT_USERS = [
  { id: '1', name: 'Admin',            userId: 'admin@example.com',   roles: 'admin,MANAGER,OPS,FINANCE_APPROVER' },
  { id: '2', name: 'Manager',          userId: 'manager@example.com', roles: 'MANAGER' },
  { id: '3', name: 'Finance Approver', userId: 'finance@example.com', roles: 'FINANCE_APPROVER' },
  { id: '4', name: 'Ops Team',         userId: 'ops@example.com',     roles: 'OPS' },
  { id: '5', name: 'Guest (read-only)', userId: 'guest@example.com',  roles: '' },
];

// ── Config helpers ─────────────────────────────────────────────────────────────
export function getApiConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); } catch { return {}; }
}
export function setApiConfig(cfg) { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); }

export function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || 'null') || DEFAULT_USERS; } catch { return DEFAULT_USERS; }
}
export function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

export function getSelectedUserId() { return localStorage.getItem(SELECTED_KEY) || '1'; }
export function setSelectedUserId(id) {
  localStorage.setItem(SELECTED_KEY, id);
  notifyUserContextChanged();
}

export function getSelectedUser() {
  const users = getUsers();
  return users.find(u => u.id === getSelectedUserId()) || users[0] || DEFAULT_USERS[0];
}

export function setRestartDraft(draft) {
  localStorage.setItem(RESTART_DRAFT_KEY, JSON.stringify(draft || {}));
}

export function getRestartDraft() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RESTART_DRAFT_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearRestartDraft() {
  localStorage.removeItem(RESTART_DRAFT_KEY);
}

// ── Default config ─────────────────────────────────────────────────────────────
export const DEFAULT_CONFIG = {
  baseUrl:      '/workflow',
  authMode:     'none',   // 'none' | 'basic' | 'apikey'
  basicUser:    '',
  basicPass:    '',
  apiKeyHeader: 'x-api-key',
  apiKeyValue:  '',
};

function cfg() { return { ...DEFAULT_CONFIG, ...getApiConfig() }; }

// ── HTTP core ──────────────────────────────────────────────────────────────────
function buildHeaders() {
  const c    = cfg();
  const user = getSelectedUser();
  const h    = { 'Content-Type': 'application/json' };

  // Identity headers — always sent, regardless of auth mode
  if (user.userId)    h['x-user-id']    = user.userId;
  if (user.roles)     h['x-user-roles'] = user.roles;

  // Authentication header — depends on selected mode
  if (c.authMode === 'basic' && c.basicUser) {
    h['Authorization'] = 'Basic ' + btoa(`${c.basicUser}:${c.basicPass}`);
  } else if (c.authMode === 'apikey' && c.apiKeyHeader && c.apiKeyValue) {
    h[c.apiKeyHeader] = c.apiKeyValue;
  }

  return h;
}

async function req(path, options = {}) {
  const url  = `${cfg().baseUrl.replace(/\/$/, '')}${path}`;
  const res  = await fetch(url, { ...options, headers: { ...buildHeaders(), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status} ${res.statusText}`);
  return data;
}

function qs(params) {
  const p = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p[k] = v;
  }
  const s = new URLSearchParams(p).toString();
  return s ? `?${s}` : '';
}

// ── Definitions ────────────────────────────────────────────────────────────────
export const getDefinitions = () => req('/definitions');

// ── Workflows ──────────────────────────────────────────────────────────────────
export const listWorkflows     = (p = {}) => req(`/workflows${qs(p)}`);
export const startWorkflow     = (body)   => req('/workflows', { method: 'POST', body: JSON.stringify(body) });
export const getWorkflow       = (id, r)  => req(`/workflows/${enc(id)}/${enc(r)}`);
export const suspendWorkflow   = (id, r)  => req(`/workflows/${enc(id)}/${enc(r)}/suspend`,  { method: 'POST' });
export const resumeWorkflow    = (id, r)  => req(`/workflows/${enc(id)}/${enc(r)}/resume`,   { method: 'POST' });
export const terminateWorkflow = (id, r, reason) =>
  req(`/workflows/${enc(id)}/${enc(r)}/terminate`, { method: 'POST', body: JSON.stringify({ reason }) });
export const cancelWorkflow    = (id, r)  => req(`/workflows/${enc(id)}/${enc(r)}/cancel`,   { method: 'POST' });
export const getActivityTree   = (id, r)  => req(`/workflows/${enc(id)}/${enc(r)}/activity-tree`);
export const getExecutionGraph = (id, r)  => req(`/workflows/${enc(id)}/${enc(r)}/execution-graph`);
export const getHistory        = (id, r)  => req(`/workflows/${enc(id)}/${enc(r)}/history`);

// ── Human Tasks ────────────────────────────────────────────────────────────────
export const listHumanTasks    = (p = {}) => req(`/human-tasks${qs(p)}`);
export const getPendingCount   = ()        => req('/human-tasks/pending-count');
export const getHumanTask      = (id)      => req(`/human-tasks/${enc(id)}`);
export const completeHumanTask = (id, res) => req(`/human-tasks/${enc(id)}/complete`, { method: 'POST', body: JSON.stringify({ result: res }) });
export const failHumanTask     = (id, reason) => req(`/human-tasks/${enc(id)}/fail`,  { method: 'POST', body: JSON.stringify({ reason }) });
export const cancelHumanTask   = (id)      => req(`/human-tasks/${enc(id)}/cancel`,   { method: 'POST' });

// ── Retry Tasks ────────────────────────────────────────────────────────────────
export const listRetryTasks     = (p = {}) => req(`/retry-tasks${qs(p)}`);
export const getRetryTask       = (id)      => req(`/retry-tasks/${enc(id)}`);
export const retryTaskSameInput = (id)      => req(`/retry-tasks/${enc(id)}/retry`,            { method: 'POST' });
export const retryTaskWithInput = (id, inp) => req(`/retry-tasks/${enc(id)}/retry-with-input`, { method: 'POST', body: JSON.stringify({ input: inp }) });
export const failRetryTask      = (id)      => req(`/retry-tasks/${enc(id)}/fail`,             { method: 'POST' });

// ── Connectivity check ─────────────────────────────────────────────────────────
export async function checkConnectivity() {
  try { await req('/definitions'); return true; } catch { return false; }
}

function enc(s) { return encodeURIComponent(s ?? ''); }
