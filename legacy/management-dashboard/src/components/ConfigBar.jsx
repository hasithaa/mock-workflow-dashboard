import { useEffect, useReducer, useState } from 'react';
import {
  getApiConfig, setApiConfig, DEFAULT_CONFIG,
  getUsers, saveUsers, DEFAULT_USERS,
  getSelectedUserId, setSelectedUserId, getSelectedUser,
  checkConnectivity,
} from '../api/managementApi';

// ── Role colour map ────────────────────────────────────────────────────────────
const ROLE_COLORS = {
  admin:             '#9b59b6',
  MANAGER:           '#2980b9',
  FINANCE_APPROVER:  '#27ae60',
  OPS:               '#e67e22',
};
const roleColor = r => ROLE_COLORS[r] || '#607080';

// Tiny force-rerender hook used so siblings can trigger a ConfigBar refresh
// after the user switches via any mechanism.
let _listeners = [];
export function notifyConfigChange() { _listeners.forEach(fn => fn()); }

export default function ConfigBar() {
  const [, rerender] = useReducer(x => x + 1, 0);
  const [connected, setConnected] = useState(null);

  // Panels
  const [showConnPanel, setShowConnPanel] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);

  // Live values (re-read from storage on every render)
  const cfg  = { ...DEFAULT_CONFIG, ...getApiConfig() };
  const user = getSelectedUser();
  const users = getUsers();
  const roles = user.roles ? user.roles.split(',').map(r => r.trim()).filter(Boolean) : [];

  // Register rerender listener
  useEffect(() => {
    _listeners.push(rerender);
    return () => { _listeners = _listeners.filter(fn => fn !== rerender); };
  }, []);

  // Connectivity ping whenever base URL or auth changes
  useEffect(() => {
    setConnected(null);
    const t = setTimeout(() => checkConnectivity().then(ok => setConnected(ok)), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.baseUrl, cfg.authMode, cfg.basicUser, cfg.basicPass, cfg.apiKeyValue]);

  const dot = connected === null ? 'checking' : connected ? 'ok' : 'error';

  return (
    <div className="topbar">
      <h1>⚡ Workflow UI</h1>

      {/* ── User switcher ─────────────────────────────────────────────────── */}
      <div className="user-switcher" onClick={() => { setShowConnPanel(false); setShowUserPanel(v => !v); }}>
        <div className="user-avatar">{user.name?.charAt(0).toUpperCase() || '?'}</div>
        <div className="user-info">
          <span className="user-name">{user.name}</span>
          <div className="user-roles-row">
            {roles.length === 0
              ? <span className="role-badge" style={{ background: '#555' }}>no roles</span>
              : roles.map(r => (
                  <span key={r} className="role-badge" style={{ background: roleColor(r) }}>{r}</span>
                ))}
          </div>
        </div>
        <span className="user-switcher-chevron">{showUserPanel ? '▲' : '▼'}</span>
      </div>

      {/* ── Connection info ───────────────────────────────────────────────── */}
      <div className="conn-section">
        <button
          className="conn-badge"
          onClick={() => { setShowUserPanel(false); setShowConnPanel(v => !v); }}
          title="Edit API connection settings"
        >
          <span className="conn-url-short">{cfg.baseUrl.replace(/^https?:\/\//, '')}</span>
          <span className={`auth-mode-tag auth-mode-${cfg.authMode}`}>{cfg.authMode}</span>
        </button>
      </div>

      <div className={`dot ${dot}`}
        title={dot === 'ok' ? 'Connected' : dot === 'error' ? 'Cannot reach Management API' : 'Checking…'} />

      {/* ── Connection dropdown panel ─────────────────────────────────────── */}
      {showConnPanel && (
        <ConnPanel cfg={cfg} onClose={() => setShowConnPanel(false)} onSave={(newCfg) => {
          setApiConfig(newCfg);
          setShowConnPanel(false);
          rerender();
        }} />
      )}

      {/* ── User dropdown panel ───────────────────────────────────────────── */}
      {showUserPanel && (
        <UserPanel
          users={users}
          selectedId={getSelectedUserId()}
          onSelect={id => { setSelectedUserId(id); rerender(); setShowUserPanel(false); }}
          onSaveUsers={u => { saveUsers(u); rerender(); }}
          onClose={() => setShowUserPanel(false)}
        />
      )}
    </div>
  );
}

// ── Connection panel ───────────────────────────────────────────────────────────
function ConnPanel({ cfg, onClose, onSave }) {
  const [draft, setDraft] = useState({ ...DEFAULT_CONFIG, ...cfg });
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  return (
    <div className="dropdown-panel conn-panel" onClick={e => e.stopPropagation()}>
      <div className="panel-header">
        <span>API Connection</span>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>

      <div className="panel-field">
        <label>Management API URL</label>
        <input className="filter-input" value={draft.baseUrl}
          placeholder="http://localhost:7234/workflow"
          onChange={e => set('baseUrl', e.target.value)} />
        <span className="field-hint">Base URL for the Ballerina Management HTTP service</span>
      </div>

      <div className="panel-field">
        <label>Authentication mode</label>
        <div className="auth-mode-row">
          {['none', 'basic', 'apikey'].map(mode => (
            <button key={mode}
              className={`auth-mode-btn${draft.authMode === mode ? ' active' : ''}`}
              onClick={() => set('authMode', mode)}>
              {mode === 'none' ? '🔓 None' : mode === 'basic' ? '🔑 Basic Auth' : '🗝 API Key'}
            </button>
          ))}
        </div>
        <span className="field-hint">
          {draft.authMode === 'none'  && 'No Authorization header — set enableBasicAuth = false on the server.'}
          {draft.authMode === 'basic' && 'Sends Authorization: Basic header. Set enableBasicAuth = true on the server.'}
          {draft.authMode === 'apikey' && 'Sends a custom header. Set enableApiKey = true on the server.'}
        </span>
      </div>

      {draft.authMode === 'basic' && (
        <div className="panel-row-2">
          <div className="panel-field">
            <label>Username</label>
            <input className="filter-input" value={draft.basicUser} placeholder="admin"
              onChange={e => set('basicUser', e.target.value)} />
          </div>
          <div className="panel-field">
            <label>Password</label>
            <input className="filter-input" type="password" value={draft.basicPass}
              placeholder="workflowadmin"
              onChange={e => set('basicPass', e.target.value)} />
          </div>
        </div>
      )}

      {draft.authMode === 'apikey' && (
        <div className="panel-row-2">
          <div className="panel-field" style={{ flex: '0 0 140px' }}>
            <label>Header name</label>
            <input className="filter-input" value={draft.apiKeyHeader} placeholder="x-api-key"
              onChange={e => set('apiKeyHeader', e.target.value)} />
          </div>
          <div className="panel-field">
            <label>Key value</label>
            <input className="filter-input" type="password" value={draft.apiKeyValue}
              placeholder="my-secret-key"
              onChange={e => set('apiKeyValue', e.target.value)} />
          </div>
        </div>
      )}

      <div className="panel-footer">
        <button className="search-btn" onClick={() => onSave(draft)}>Apply</button>
        <button className="back-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ── User panel ─────────────────────────────────────────────────────────────────
function UserPanel({ users, selectedId, onSelect, onSaveUsers, onClose }) {
  const [editing, setEditing] = useState(false);
  const [draftUsers, setDraftUsers] = useState(users);
  const [editRow, setEditRow] = useState(null); // user object or 'new'

  const roles = u => u.roles ? u.roles.split(',').map(r => r.trim()).filter(Boolean) : [];

  if (editing) {
    return (
      <div className="dropdown-panel user-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <button className="icon-btn" onClick={() => setEditing(false)}>← Back</button>
          <span>Manage Mock Users</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <p className="user-mgmt-hint">
          <code>x-user-id</code> and <code>x-user-roles</code> are sent on every request
          regardless of the auth mode. Use them to simulate different identities.
        </p>
        <div className="user-mgmt-list">
          {draftUsers.map(u => (
            <div key={u.id} className="user-mgmt-row">
              {editRow?.id === u.id ? (
                <UserEditRow
                  init={editRow}
                  onSave={updated => {
                    setDraftUsers(prev => prev.map(x => x.id === updated.id ? updated : x));
                    setEditRow(null);
                  }}
                  onCancel={() => setEditRow(null)}
                />
              ) : (
                <>
                  <div className="user-avatar sm">{u.name.charAt(0)}</div>
                  <div className="user-mgmt-info">
                    <strong>{u.name}</strong>
                    <span className="user-mgmt-uid">{u.userId}</span>
                    <div className="user-roles-row">
                      {roles(u).map(r => <span key={r} className="role-badge sm" style={{ background: roleColor(r) }}>{r}</span>)}
                      {roles(u).length === 0 && <span className="role-badge sm" style={{ background: '#555' }}>no roles</span>}
                    </div>
                  </div>
                  <div className="user-mgmt-actions">
                    <button className="back-btn" onClick={() => setEditRow({ ...u })}>Edit</button>
                    <button className="back-btn"
                      onClick={() => setDraftUsers(prev => prev.filter(x => x.id !== u.id))}>✕</button>
                  </div>
                </>
              )}
            </div>
          ))}
          {editRow === 'new' ? (
            <div className="user-mgmt-row">
              <UserEditRow
                init={{ id: Date.now().toString(), name: '', userId: '', roles: '' }}
                onSave={u => { setDraftUsers(prev => [...prev, u]); setEditRow(null); }}
                onCancel={() => setEditRow(null)}
                isNew
              />
            </div>
          ) : (
            <button className="back-btn add-user-btn" onClick={() => setEditRow('new')}>+ Add user</button>
          )}
        </div>
        <div className="panel-footer">
          <button className="search-btn" onClick={() => { onSaveUsers(draftUsers); setEditing(false); }}>Save</button>
          <button className="back-btn" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dropdown-panel user-panel" onClick={e => e.stopPropagation()}>
      <div className="panel-header">
        <span>Switch User</span>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>
      <div className="user-list">
        {users.map(u => (
          <div key={u.id}
            className={`user-list-row${u.id === selectedId ? ' selected' : ''}`}
            onClick={() => onSelect(u.id)}>
            <div className="user-avatar sm">{u.name.charAt(0)}</div>
            <div className="user-mgmt-info">
              <strong>{u.name}</strong>
              <span className="user-mgmt-uid">{u.userId}</span>
              <div className="user-roles-row">
                {roles(u).map(r => <span key={r} className="role-badge sm" style={{ background: roleColor(r) }}>{r}</span>)}
                {roles(u).length === 0 && <span className="role-badge sm" style={{ background: '#555' }}>no roles</span>}
              </div>
            </div>
            {u.id === selectedId && <span className="user-check">✓</span>}
          </div>
        ))}
      </div>
      <div className="panel-footer">
        <button className="back-btn" onClick={() => { setDraftUsers(users); setEditing(true); }}>⚙ Manage users</button>
      </div>
    </div>
  );
}

// ── Inline user edit row ───────────────────────────────────────────────────────
function UserEditRow({ init, onSave, onCancel, isNew = false }) {
  const [u, setU] = useState(init);
  return (
    <div className="user-edit-form">
      <input className="filter-input" placeholder="Name" value={u.name} style={{ width: 110 }}
        onChange={e => setU(p => ({ ...p, name: e.target.value }))} />
      <input className="filter-input" placeholder="x-user-id" value={u.userId} style={{ width: 160 }}
        onChange={e => setU(p => ({ ...p, userId: e.target.value }))} />
      <input className="filter-input" placeholder="Roles (comma-sep)" value={u.roles} style={{ width: 200 }}
        onChange={e => setU(p => ({ ...p, roles: e.target.value }))} />
      <button className="search-btn" style={{ padding: '2px 10px' }}
        onClick={() => u.name.trim() && onSave(u)}>{isNew ? 'Add' : 'Save'}</button>
      <button className="back-btn" onClick={onCancel}>✕</button>
    </div>
  );
}
