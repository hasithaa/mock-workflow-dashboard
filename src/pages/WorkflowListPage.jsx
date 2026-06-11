import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import {
  listWorkflows,
  getDefinitions,
  setRestartDraft,
  getSelectedUser,
  USER_CONTEXT_CHANGED_EVENT,
} from '../api/managementApi';
import { isUserPortalView } from '../utils/portalView';

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function isRunningStatus(status) {
  return String(status || '').toUpperCase() === 'RUNNING';
}

function ResultRow({ exec, canRestart, onOpenDetail, onRestart }) {
  const [expanded, setExpanded] = useState(false);
  const running = isRunningStatus(exec.status);
  const restartDisabled = running || !canRestart;
  const restartTitle = running
    ? 'Restart is only available for non-running workflows'
    : canRestart
      ? 'Restart this workflow with pre-filled input'
      : 'Workflow type belongs to another integration; start form unavailable here';
  return (
    <div className={`result-row${expanded ? ' expanded' : ''}`}>
      <div className="result-main" onClick={() => setExpanded(e => !e)}>
        <span className="result-chevron">{expanded ? '▼' : '▶'}</span>
        <span className="result-wfid" title={exec.workflowId}>{exec.workflowId}</span>
        <span className="result-type" title={exec.workflowType}>{exec.workflowType}</span>
        <StatusBadge status={exec.status} />
        <span className="result-time">{fmtTime(exec.startTime)}</span>
      </div>
      {expanded && (
        <div className="result-detail">
          <div className="result-detail-grid">
            <div><span className="rd-label">Run ID</span><span className="rd-value mono">{exec.runId}</span></div>
            <div><span className="rd-label">Closed</span><span className="rd-value">{fmtTime(exec.closeTime)}</span></div>
            <div><span className="rd-label">Type</span><span className="rd-value">{exec.workflowType}</span></div>
          </div>
          <div className="result-actions">
            <button className="open-detail-btn" onClick={() => onOpenDetail(exec)}>Open Full Details →</button>
            <button
              className="def-launch-btn-inline"
              onClick={() => onRestart(exec)}
              disabled={restartDisabled}
              title={restartTitle}
            >
              ↻ Restart Workflow
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowListPage({ preset, title }) {
  const isUserPortal = isUserPortalView();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextToken, setNextToken] = useState(null);
  const [prevTokens, setPrevTokens] = useState([]);
  const [localTypes, setLocalTypes] = useState(new Set());

  const buildQuery = () => {
    if (preset === 'recent') {
      return { startTimeFrom: new Date(Date.now() - 60 * 60 * 1000).toISOString() };
    }
    if (preset === 'active') {
      return { status: 'Running' };
    }
    return {};
  };

  const load = (token = null) => {
    setLoading(true);
    setError(null);
    const startedBy = isUserPortal ? getSelectedUser()?.userId : null;
    const params = {
      limit: 30,
      ...buildQuery(),
      ...(token ? { pageToken: token } : {}),
      ...(startedBy ? { startedBy } : {}),
    };
    listWorkflows(params)
      .then(d => {
        setResults(d.items || []);
        setNextToken(d.nextPageToken || null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPrevTokens([]); load(); }, [preset]);

  useEffect(() => {
    getDefinitions()
      .then(d => {
        const types = new Set((d.definitions || []).map(def => def.workflowType));
        setLocalTypes(types);
      })
      .catch(() => setLocalTypes(new Set()));
  }, []);

  useEffect(() => {
    const onUserContextChanged = () => {
      setPrevTokens([]);
      load();
    };
    window.addEventListener(USER_CONTEXT_CHANGED_EVENT, onUserContextChanged);
    return () => window.removeEventListener(USER_CONTEXT_CHANGED_EVENT, onUserContextChanged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const goNext = () => { setPrevTokens(p => [...p, nextToken]); load(nextToken); };
  const goPrev = () => { const t = [...prevTokens]; const prev = t.pop() ?? null; setPrevTokens(t); load(prev); };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{title}</h2>
        <span className="type-count">{results.length} shown</span>
        <button className="refresh-btn" onClick={() => { setPrevTokens([]); load(); }}>↺ Refresh</button>
      </div>
      <p className="page-subtitle">
        {isUserPortal
          ? 'Showing only workflow instances started by the selected user'
          : preset === 'recent'
            ? 'Workflows started in the last hour'
            : 'Currently running workflows'}
      </p>

      <div className="results-section">
        {loading && <div className="loading">Loading…</div>}
        {error && <div className="error-msg">{error}</div>}
        {!loading && !error && results.length === 0 && (
          <div className="loading">No workflows found</div>
        )}
        {results.map(exec => (
          <ResultRow
            key={`${exec.workflowId}-${exec.runId}`}
            exec={exec}
            canRestart={localTypes.has(exec.workflowType)}
            onOpenDetail={exec => navigate(`/detail/${encodeURIComponent(exec.workflowId)}/${encodeURIComponent(exec.runId)}`)}
            onRestart={exec => {
              setRestartDraft({ workflowType: exec.workflowType, input: exec.input ?? null });
              navigate(`/definitions?launchType=${encodeURIComponent(exec.workflowType)}`);
            }}
          />
        ))}
        {(prevTokens.length > 0 || nextToken) && (
          <div className="pagination">
            <button className="page-btn" disabled={prevTokens.length === 0} onClick={goPrev}>← Prev</button>
            <span className="page-info">Page {prevTokens.length + 1}</span>
            <button className="page-btn" disabled={!nextToken} onClick={goNext}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
