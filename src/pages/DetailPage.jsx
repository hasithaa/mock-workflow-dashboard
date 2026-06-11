import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import {
  getWorkflow, listWorkflows, listHumanTasks, getActivityTree, getHistory,
  suspendWorkflow, resumeWorkflow, terminateWorkflow, cancelWorkflow, getSelectedUser,
} from '../api/managementApi';
import { isUserPortalView } from '../utils/portalView';

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function JsonBlock({ label, data }) {
  const isEmpty = data === null || data === undefined;
  const str = isEmpty ? null : (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return (
    <div className="io-card">
      <div className="io-label">{label}</div>
      {isEmpty ? <span className="io-empty">—</span> : <pre className="io-json">{str}</pre>}
    </div>
  );
}

function MetaCard({ label, children }) {
  return (
    <div className="meta-card">
      <div className="meta-label">{label}</div>
      <div className="meta-value">{children}</div>
    </div>
  );
}

function coalesce(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

function decodeTemporalPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const encoded = payload.data;
  if (!encoded || typeof encoded !== 'string') {
    return null;
  }

  try {
    const text = atob(encoded);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function decodeTemporalPayloadContainer(container) {
  const payloads = container?.payloads;
  if (!Array.isArray(payloads) || payloads.length === 0) {
    return null;
  }

  const decoded = payloads
    .map(decodeTemporalPayload)
    .filter(value => value !== null && value !== undefined)
    .filter(value => !(value && typeof value === 'object' && value.__callConfig__ === true));

  if (decoded.length === 0) {
    return null;
  }
  if (decoded.length === 1) {
    return decoded[0];
  }
  return decoded;
}

function extractHistoryWorkflowInput(events) {
  if (!Array.isArray(events)) {
    return null;
  }
  const started = events.find(event => event?.eventType === 'WORKFLOW_EXECUTION_STARTED');
  return decodeTemporalPayloadContainer(started?.attributes?.input);
}

function extractHistoryWorkflowOutput(events) {
  if (!Array.isArray(events)) {
    return null;
  }
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event?.eventType === 'WORKFLOW_EXECUTION_COMPLETED') {
      return decodeTemporalPayloadContainer(event?.attributes?.result);
    }
  }
  return null;
}

function firstMeaningfulActivityValue(invocations, key) {
  if (!Array.isArray(invocations)) {
    return null;
  }

  if (key === 'input') {
    for (const it of invocations) {
      const v = it?.input;
      if (Array.isArray(v) && v.length > 0) {
        return v.length === 1 ? v[0] : v;
      }
      if (v !== null && v !== undefined && !Array.isArray(v)) {
        return v;
      }
    }
    return null;
  }

  for (let i = invocations.length - 1; i >= 0; i--) {
    const v = invocations[i]?.[key];
    if (v !== null && v !== undefined) {
      return v;
    }
  }
  return null;
}

// ── Activity Tree ─────────────────────────────────────────────────────────────

const NODE_ICONS = {
  ACTIVITY: '⚙',
  TIMER: '⏱',
  SIGNAL: '📡',
  CHILD_WORKFLOW: '⬡',
  HUMAN_TASK: '👤',
  RETRY_TASK: '🔄',
};

const STATUS_CLASSES = {
  COMPLETED: 'node-completed',
  FAILED: 'node-failed',
  RUNNING: 'node-running',
  TIMED_OUT: 'node-timed-out',
  CANCELED: 'node-canceled',
};

function ActivityTreeView({ workflowId, runId }) {
  const [nodes, setNodes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    getActivityTree(workflowId, runId)
      .then(d => setNodes(d.nodes || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [workflowId, runId]);

  if (loading) return <div className="loading">Loading activity tree…</div>;
  if (error)   return <div className="error-msg">Activity tree: {error}</div>;
  if (!nodes?.length) return <div className="loading">No execution steps recorded yet.</div>;

  return (
    <div className="activity-tree">
      {nodes.map(node => {
        const icon = NODE_ICONS[node.type] || '•';
        const cls  = STATUS_CLASSES[node.status] || 'node-running';
        const key  = node.id;
        const open = !!expanded[key];
        const hasDetail = node.input || node.output || node.failure;
        return (
          <div key={key} className={`tree-node ${cls}`}>
            <div className="tree-node-header" onClick={() => hasDetail && setExpanded(e => ({ ...e, [key]: !open }))}>
              <span className="tree-node-icon">{icon}</span>
              <span className="tree-node-name">{node.name}</span>
              <span className="tree-node-type">{node.type}</span>
              <StatusBadge status={node.status} />
              {node.attempt > 1 && <span className="tree-node-attempt">attempt {node.attempt}</span>}
              <span className="tree-node-time">{fmtTime(node.startTime)}</span>
              {node.endTime && <span className="tree-node-duration">→ {fmtTime(node.endTime)}</span>}
              {hasDetail && <span className="tree-chevron">{open ? '▼' : '▶'}</span>}
            </div>
            {open && (
              <div className="tree-node-detail">
                {node.failure && (
                  <div className="tree-failure">
                    <span className="tree-fail-icon">❌</span>
                    <span>{node.failure.message}</span>
                    {node.failure.type && <span className="tree-fail-type"> [{node.failure.type}]</span>}
                  </div>
                )}
                {node.input  && <JsonBlock label="Input"  data={node.input}  />}
                {node.output && <JsonBlock label="Output" data={node.output} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Pending Human Tasks ───────────────────────────────────────────────────────

function PendingHumanTasks({ workflowId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listHumanTasks({ status: 'PENDING', parentWorkflowId: workflowId, limit: 20 })
      .then(d => setTasks(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workflowId]);

  if (loading || tasks.length === 0) return null;

  return (
    <div className="pending-tasks-section">
      <div className="section-heading">
        Pending Human Tasks <span className="section-count">({tasks.length})</span>
      </div>
      <div className="pending-tasks-list">
        {tasks.map(t => (
          <Link key={t.taskId}
            to={`/tasks?parentWorkflowId=${encodeURIComponent(workflowId)}`}
            className="pending-task-row">
            <span className="ht-indicator pending" />
            <div className="pending-task-info">
              <span className="pending-task-title">{t.taskName}</span>
            </div>
            <div className="pending-task-roles">
              {(t.userRoles || []).map(r => <span key={r} className="role-pill">{r}</span>)}
            </div>
            <StatusBadge status={t.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Lifecycle Actions ─────────────────────────────────────────────────────────

function LifecycleActions({ workflowId, runId, status, onRefresh }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const act = async (label, fn) => {
    setBusy(label); setError(null);
    try { await fn(); onRefresh(); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  };

  const isRunning = status === 'Running' || status === 'RUNNING';

  return (
    <div className="lifecycle-actions">
      {isRunning && <>
        <button className="back-btn" disabled={!!busy}
          onClick={() => act('Suspend', () => suspendWorkflow(workflowId, runId))}>
          {busy === 'Suspend' ? '…' : '⏸ Suspend'}
        </button>
        <button className="back-btn" disabled={!!busy}
          onClick={() => act('Cancel', () => cancelWorkflow(workflowId, runId))}>
          {busy === 'Cancel' ? '…' : '✕ Cancel'}
        </button>
        <button className="cancel-task-btn" disabled={!!busy}
          onClick={() => act('Terminate', () => terminateWorkflow(workflowId, runId, 'Manual termination'))}>
          {busy === 'Terminate' ? '…' : '⛔ Terminate'}
        </button>
      </>}
      {(status === 'Suspended' || status === 'SUSPENDED') && (
        <button className="search-btn" disabled={!!busy}
          onClick={() => act('Resume', () => resumeWorkflow(workflowId, runId))}>
          {busy === 'Resume' ? '…' : '▶ Resume'}
        </button>
      )}
      {error && <span className="complete-error" style={{ marginLeft: 8 }}>{error}</span>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DetailPage() {
  const isUserPortal = isUserPortalView();
  const { workflowId, runId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const load = () => {
    setLoading(true); setError(null);
    const startedBy = isUserPortal ? getSelectedUser()?.userId : null;
    const listParams = {
      workflowId,
      limit: 100,
      ...(startedBy ? { startedBy } : {}),
    };

    listWorkflows(listParams)
      .then(listResp => {
        const summary = (listResp?.items || []).find(
          item => item.workflowId === workflowId && item.runId === runId,
        ) || null;

        if (isUserPortal && !summary) {
          setDetail(null);
          throw new Error('User Portal only allows viewing workflow instances started by the selected user.');
        }

        return Promise.all([
          getWorkflow(workflowId, runId),
          getHistory(workflowId, runId).catch(() => ({ events: [] })),
          Promise.resolve(summary),
        ]);
      })
      .then(([d, historyResp, summary]) => {
        const historyEvents = historyResp?.events || [];
        const historyInput = extractHistoryWorkflowInput(historyEvents);
        const historyOutput = extractHistoryWorkflowOutput(historyEvents);

        const activityInput = isUserPortal ? null : firstMeaningfulActivityValue(d?.activityInvocations, 'input');
        const activityOutput = isUserPortal ? null : firstMeaningfulActivityValue(d?.activityInvocations, 'output');

        setDetail({
          ...summary,
          ...d,
          startTime: coalesce(d?.startTime, summary?.startTime),
          closeTime: coalesce(d?.closeTime, summary?.closeTime),
          input: coalesce(
            d?.input,
            summary?.input,
            d?.workflowInput,
            summary?.workflowInput,
            historyInput,
            activityInput,
          ),
          output: coalesce(
            d?.output,
            d?.result,
            summary?.output,
            summary?.result,
            historyOutput,
            activityOutput,
          ),
        });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDetail(null); load(); }, [workflowId, runId, isUserPortal]);

  return (
    <div className="page detail-page">
      <div className="page-header detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div className="detail-title-block">
          <h2 className="page-title mono">{workflowId}</h2>
          <div className="detail-run-id">Run ID: <span className="mono">{runId}</span></div>
        </div>
        {detail && <StatusBadge status={detail.status} />}
        {detail && (
          <LifecycleActions workflowId={workflowId} runId={runId}
            status={detail.status} onRefresh={load} />
        )}
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-msg">{error}</div>}

      {detail && (
        <>
          {!isUserPortal && (
            <div className="tabs">
              {['overview', 'activity-tree'].map(tab => (
                <button key={tab} className={`tab-btn${activeTab === tab ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab)}>
                  {tab === 'overview' ? '📋 Overview' : '⚙ Activity Tree'}
                </button>
              ))}
            </div>
          )}

          {(isUserPortal || activeTab === 'overview') && (
            <>
              <div className="io-section">
                <JsonBlock label="📥 Input" data={detail.input} />
                {detail.errorMessage ? (
                  <div className="io-card io-error-card">
                    <div className="io-label">❌ Failure</div>
                    <div className="io-failure-msg">{detail.errorMessage}</div>
                  </div>
                ) : (
                  <JsonBlock label="📤 Output" data={detail.output} />
                )}
              </div>

              {!isUserPortal && (
                <>
                  <div className="meta-grid">
                    <MetaCard label="Workflow Type">{detail.workflowType}</MetaCard>
                    <MetaCard label="Status"><StatusBadge status={detail.status} /></MetaCard>
                    <MetaCard label="Start Time">{fmtTime(detail.startTime)}</MetaCard>
                    <MetaCard label="Close Time">{fmtTime(detail.closeTime)}</MetaCard>
                  </div>

                  <PendingHumanTasks workflowId={workflowId} />
                </>
              )}
            </>
          )}

          {!isUserPortal && activeTab === 'activity-tree' && (
            <ActivityTreeView workflowId={workflowId} runId={runId} />
          )}
        </>
      )}
    </div>
  );
}
