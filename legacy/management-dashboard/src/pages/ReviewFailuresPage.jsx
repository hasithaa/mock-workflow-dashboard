import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { listRetryTasks, getRetryTask, retryTaskSameInput, retryTaskWithInput, failRetryTask } from '../api/managementApi';

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

// ── Row ───────────────────────────────────────────────────────────────────────

function RetryTaskRow({ task, isSelected, onClick }) {
  const isPending = task.status === 'PENDING';
  return (
    <div className={`ht-row${isSelected ? ' selected' : ''}`} onClick={onClick}>
      <div className="ht-row-main">
        <span className={`ht-indicator${isPending ? ' pending' : ''}`} />
        <div className="ht-row-info">
          <div className="ht-title">{task.taskName}</div>
          <div className="ht-sub">
            <span className="ht-name">{task.activityName}</span>
            {task.parentWorkflowId && (
              <span className="ht-parent" title={task.parentWorkflowId}>↑ {task.parentWorkflowId}</span>
            )}
          </div>
          {task.errorMessage && (
            <div className="retry-task-error">{task.errorMessage}</div>
          )}
        </div>
        <div className="ht-row-right">
          <StatusBadge status={task.status} />
          <div className="ht-time">{fmtTime(task.startTime)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function RetryDecisionForm({ task, onDone, onCancel }) {
  const [action, setAction] = useState('retry');
  const [inputJson, setInputJson] = useState(
    () => JSON.stringify(task.activityArgs || {}, null, 2)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      if (action === 'retry') {
        await retryTaskSameInput(task.taskId);
      } else if (action === 'retry-with-input') {
        let parsed;
        try { parsed = JSON.parse(inputJson); } catch { setError('Invalid JSON'); setSubmitting(false); return; }
        await retryTaskWithInput(task.taskId, parsed);
      } else {
        await failRetryTask(task.taskId);
      }
      onDone();
    } catch (e) { setError(e.message); } finally { setSubmitting(false); }
  };

  return (
    <div className="complete-form">
      <div className="complete-form-label">Decision</div>
      <div className="retry-action-btns">
        {['retry', 'retry-with-input', 'fail'].map(a => (
          <button key={a}
            className={`retry-action-btn${action === a ? ' active' : ''}`}
            onClick={() => setAction(a)}>
            {a === 'retry' ? '🔄 Retry Same Input' : a === 'retry-with-input' ? '✏ Retry with New Input' : '⛔ Permanently Fail'}
          </button>
        ))}
      </div>

      {action === 'retry-with-input' && (
        <>
          <div className="complete-form-label" style={{ marginTop: 12 }}>New Input JSON</div>
          <textarea className="result-textarea" value={inputJson}
            onChange={e => setInputJson(e.target.value)} rows={6} spellCheck={false} />
        </>
      )}

      {action === 'fail' && (
        <div className="cancel-confirm-msg" style={{ marginTop: 8 }}>
          This will permanently fail the activity. The parent workflow will receive an error and will not retry.
        </div>
      )}

      {error && <div className="complete-error">{error}</div>}
      <div className="complete-actions" style={{ marginTop: 12 }}>
        <button className={action === 'fail' ? 'cancel-task-btn' : 'search-btn'}
          onClick={submit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Decision'}
        </button>
        <button className="back-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function RetryTaskDetailPanel({ taskId, onClose, onActionDone }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDecision, setShowDecision] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    getRetryTask(taskId)
      .then(d => setDetail(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [taskId]);

  useEffect(load, [load]);

  const handleDecisionDone = () => { setShowDecision(false); load(); if (onActionDone) onActionDone(); };

  return (
    <div className="task-detail-panel">
      <div className="task-detail-header">
        <button className="back-btn" onClick={onClose}>← Back</button>
        {detail && <StatusBadge status={detail.status} />}
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-msg">{error}</div>}

      {detail && !showDecision && (
        <div className="task-detail-body">
          <div className="task-detail-title">{detail.taskName}</div>
          <div className="task-detail-sub">{detail.taskId}</div>

          <div className="task-meta-grid">
            <div className="task-meta-card">
              <div className="task-meta-label">Activity</div>
              <div className="task-meta-value">{detail.activityName}</div>
            </div>
            <div className="task-meta-card">
              <div className="task-meta-label">Status</div>
              <div className="task-meta-value"><StatusBadge status={detail.status} /></div>
            </div>
            <div className="task-meta-card">
              <div className="task-meta-label">Parent Workflow</div>
              <div className="task-meta-value">
                <Link to={`/search?workflowId=${encodeURIComponent(detail.parentWorkflowId)}`}
                  className="parent-wf-link">{detail.parentWorkflowId}</Link>
              </div>
            </div>
            <div className="task-meta-card">
              <div className="task-meta-label">Created</div>
              <div className="task-meta-value">{fmtTime(detail.createdAt)}</div>
            </div>
            {detail.decidedBy && (
              <div className="task-meta-card">
                <div className="task-meta-label">Decided By</div>
                <div className="task-meta-value">{detail.decidedBy} · {fmtTime(detail.decidedAt)}</div>
              </div>
            )}
          </div>

          <div className="task-detail-section">
            <div className="task-section-label">Error</div>
            <div className="retry-error-box">{detail.errorMessage || '—'}</div>
          </div>

          {detail.activityArgs && (
            <div className="task-detail-section">
              <div className="task-section-label">Activity Arguments</div>
              <pre className="io-json">{JSON.stringify(detail.activityArgs, null, 2)}</pre>
            </div>
          )}

          {detail.status === 'PENDING' && (
            <div className="task-actions">
              <button className="search-btn" onClick={() => setShowDecision(true)}>Make Decision</button>
            </div>
          )}
        </div>
      )}

      {showDecision && detail && (
        <RetryDecisionForm task={detail} onDone={handleDecisionDone} onCancel={() => setShowDecision(false)} />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const STATUS_TABS = ['Pending', 'All', 'Completed'];
const STATUS_MAP = { Pending: 'PENDING', All: '', Completed: 'COMPLETED' };

export default function ReviewFailuresPage() {
  const { taskId: routeTaskId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Pending');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextToken, setNextToken] = useState(null);
  const [prevTokens, setPrevTokens] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(routeTaskId || null);

  const load = useCallback((token = null) => {
    setLoading(true); setError(null);
    const params = { limit: 30 };
    const statusVal = STATUS_MAP[activeTab];
    if (statusVal) params.status = statusVal;
    if (token) params.pageToken = token;
    listRetryTasks(params)
      .then(d => { setTasks(d.items || []); setNextToken(d.nextPageToken || null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeTab]);

  useEffect(() => { setPrevTokens([]); setNextToken(null); load(null); }, [load]);

  const goNext = () => { setPrevTokens(p => [...p, nextToken]); load(nextToken); };
  const goPrev = () => { const t = [...prevTokens]; const p = t.pop() ?? null; setPrevTokens(t); load(p); };
  const switchTab = (tab) => { setActiveTab(tab); setSelectedTaskId(null); };
  const handleSelect = (id) => {
    const next = selectedTaskId === id ? null : id;
    setSelectedTaskId(next);
    navigate(next ? `/review-failures/${encodeURIComponent(next)}` : '/review-failures', { replace: true });
  };

  return (
    <div className="page ht-page">
      <div className="page-header">
        <h2 className="page-title">Review Failures</h2>
        <span className="page-subtitle-inline">Manual retry decisions for failed activities</span>
        <button className="refresh-btn" onClick={() => load(null)}>↺ Refresh</button>
      </div>

      <div className="ht-layout">
        <div className="ht-list-pane">
          <div className="tabs">
            {STATUS_TABS.map(tab => (
              <button key={tab} className={`tab-btn${activeTab === tab ? ' active' : ''}`}
                onClick={() => switchTab(tab)}>{tab}</button>
            ))}
          </div>

          <div className="ht-list-body">
            {loading && <div className="loading">Loading…</div>}
            {error && <div className="error-msg">{error}</div>}
            {!loading && !error && tasks.length === 0 && (
              <div className="loading">No {activeTab.toLowerCase()} retry tasks found.</div>
            )}
            {tasks.map(task => (
              <RetryTaskRow key={task.taskId} task={task}
                isSelected={selectedTaskId === task.taskId}
                onClick={() => handleSelect(task.taskId)} />
            ))}
          </div>

          {(prevTokens.length > 0 || nextToken) && (
            <div className="pagination">
              <button className="page-btn" disabled={prevTokens.length === 0} onClick={goPrev}>← Prev</button>
              <span className="page-info">Page {prevTokens.length + 1}</span>
              <button className="page-btn" disabled={!nextToken} onClick={goNext}>Next →</button>
            </div>
          )}
        </div>

        {selectedTaskId && (
          <div className="ht-detail-pane">
            <RetryTaskDetailPanel taskId={selectedTaskId}
              onClose={() => handleSelect(selectedTaskId)}
              onActionDone={() => load(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
