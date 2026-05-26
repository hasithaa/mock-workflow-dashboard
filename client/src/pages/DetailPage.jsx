import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';

const EVENT_NAMES = {
  1: 'WorkflowExecutionStarted', 2: 'WorkflowExecutionCompleted', 3: 'WorkflowExecutionFailed',
  4: 'WorkflowExecutionTimedOut', 5: 'WorkflowTaskScheduled', 6: 'WorkflowTaskStarted',
  7: 'WorkflowTaskCompleted', 8: 'WorkflowTaskTimedOut', 9: 'WorkflowTaskFailed',
  10: 'ActivityTaskScheduled', 11: 'ActivityTaskStarted', 12: 'ActivityTaskCompleted',
  13: 'ActivityTaskFailed', 14: 'ActivityTaskTimedOut', 15: 'ActivityTaskCancelRequested',
  16: 'ActivityTaskCanceled', 17: 'TimerStarted', 18: 'TimerFired', 19: 'TimerCanceled',
  20: 'WorkflowExecutionCancelRequested', 21: 'WorkflowExecutionCanceled',
  22: 'RequestCancelExternalWorkflowExecutionInitiated',
  23: 'RequestCancelExternalWorkflowExecutionFailed',
  24: 'ExternalWorkflowExecutionCancelRequested',
  25: 'MarkerRecorded', 26: 'WorkflowExecutionSignaled',
  27: 'WorkflowExecutionTerminated', 28: 'WorkflowExecutionContinuedAsNew',
  29: 'StartChildWorkflowExecutionInitiated', 30: 'StartChildWorkflowExecutionFailed',
  31: 'ChildWorkflowExecutionStarted', 32: 'ChildWorkflowExecutionCompleted',
  33: 'ChildWorkflowExecutionFailed', 34: 'ChildWorkflowExecutionCanceled',
  35: 'ChildWorkflowExecutionTimedOut', 36: 'ChildWorkflowExecutionTerminated',
  37: 'SignalExternalWorkflowExecutionInitiated', 38: 'SignalExternalWorkflowExecutionFailed',
  39: 'ExternalWorkflowExecutionSignaled', 40: 'UpsertWorkflowSearchAttributes',
};

function eventName(type) {
  return EVENT_NAMES[type] ?? (typeof type === 'string' ? type.replace('EVENT_TYPE_', '') : `Event(${type})`);
}

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
      {isEmpty ? (
        <div className="io-empty">—</div>
      ) : (
        <pre className="io-pre">{str}</pre>
      )}
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

export default function DetailPage() {
  const { workflowId, runId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDetail(null);
    fetch(`/api/workflows/${encodeURIComponent(workflowId)}/${encodeURIComponent(runId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setDetail(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [workflowId, runId]);

  return (
    <div className="page detail-page">
      <div className="page-header detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div className="detail-title-block">
          <h2 className="page-title mono">{workflowId}</h2>
          <div className="detail-run-id">Run ID: <span className="mono">{runId}</span></div>
        </div>
        {detail && <StatusBadge status={detail.status} />}
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-msg">{error}</div>}

      {detail && (
        <>
          {/* Input / Output */}
          <div className="io-section">
            <JsonBlock label="📥 Input" data={detail.input} />
            {detail.failureInfo ? (
              <div className="io-card io-error-card">
                <div className="io-label">❌ Failure</div>
                <div className="io-failure-type">{detail.failureInfo.type}</div>
                <div className="io-failure-msg">{detail.failureInfo.message}</div>
              </div>
            ) : (
              <JsonBlock label="📤 Output" data={detail.output} />
            )}
          </div>

          {/* Metadata */}
          <div className="meta-grid">
            <MetaCard label="Workflow Type">{detail.workflowType}</MetaCard>
            <MetaCard label="Status"><StatusBadge status={detail.status} /></MetaCard>
            <MetaCard label="Task Queue">{detail.taskQueue || '—'}</MetaCard>
            <MetaCard label="History Length">{detail.historyLength} events</MetaCard>
            <MetaCard label="Start Time">{fmtTime(detail.startTime)}</MetaCard>
            <MetaCard label="Close Time">{fmtTime(detail.closeTime)}</MetaCard>
          </div>

          {/* History */}
          <div className="section-heading">History Events <span className="section-count">(first 100)</span></div>
          <table className="history-table">
            <thead>
              <tr><th>#</th><th>Event Type</th><th>Time</th></tr>
            </thead>
            <tbody>
              {detail.historyEvents.map(ev => (
                <tr key={ev.eventId}>
                  <td className="ev-id">{ev.eventId}</td>
                  <td className="ev-type">{eventName(ev.eventType)}</td>
                  <td className="ev-time">{fmtTime(ev.eventTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
