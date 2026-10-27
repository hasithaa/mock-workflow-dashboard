import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TaskDetailPanel, TaskRow } from '../components/TaskDetail';
import { listHumanTasks, USER_CONTEXT_CHANGED_EVENT } from '../api/managementApi';

const STATUS_TABS = ['Pending', 'All', 'Completed', 'Failed', 'Canceled'];
const STATUS_MAP = { Pending: 'RUNNING', All: '', Completed: 'COMPLETED', Failed: 'FAILED', Canceled: 'CANCELED' };

const TITLE_MAP = {
  Pending: 'Pending Tasks',
  Completed: 'Completed Tasks',
  Failed: 'Failed Tasks',
  All: 'Human Tasks',
};

export default function HumanTasksPage({ defaultTab = 'Pending' }) {
  const [searchParams] = useSearchParams();
  const parentFilter = searchParams.get('parentWorkflowId');

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextToken, setNextToken] = useState(null);
  const [prevTokens, setPrevTokens] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const load = useCallback((token = null) => {
    setLoading(true);
    setError(null);
    const params = { limit: 30 };
    const statusVal = STATUS_MAP[activeTab];
    if (statusVal) params.status = statusVal;
    if (parentFilter) params.parentWorkflowId = parentFilter;
    if (token) params.pageToken = token;
    listHumanTasks(params)
      .then(d => { setTasks(d.items || []); setNextToken(d.nextPageToken || null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeTab, parentFilter]);

  useEffect(() => {
    setPrevTokens([]);
    setNextToken(null);
    load(null);
  }, [load]);

  useEffect(() => {
    const onUserContextChanged = () => {
      setSelectedTaskId(null);
      setPrevTokens([]);
      setNextToken(null);
      load(null);
    };
    window.addEventListener(USER_CONTEXT_CHANGED_EVENT, onUserContextChanged);
    return () => window.removeEventListener(USER_CONTEXT_CHANGED_EVENT, onUserContextChanged);
  }, [load]);

  const goNext = () => { setPrevTokens(p => [...p, nextToken]); load(nextToken); };
  const goPrev = () => { const t = [...prevTokens]; const prev = t.pop() ?? null; setPrevTokens(t); load(prev); };
  const switchTab = (tab) => { setActiveTab(tab); setSelectedTaskId(null); };
  const handleSelect = (taskId) => setSelectedTaskId(prev => prev === taskId ? null : taskId);

  return (
    <div className="page ht-page">
      <div className="page-header">
        <h2 className="page-title">{TITLE_MAP[defaultTab] ?? 'Human Tasks'}</h2>
        {parentFilter && <span className="filter-pill">parent: {parentFilter}</span>}
        <button className="refresh-btn" onClick={() => load(null)}>↺ Refresh</button>
      </div>

      <div className="ht-layout">
        <div className="ht-list-pane">
          <div className="tabs">
            {STATUS_TABS.map(tab => (
              <button
                key={tab}
                className={`tab-btn${activeTab === tab ? ' active' : ''}`}
                onClick={() => switchTab(tab)}
              >{tab}</button>
            ))}
          </div>

          <div className="ht-list-body">
            {loading && <div className="loading">Loading…</div>}
            {error && <div className="error-msg">{error}</div>}
            {!loading && !error && tasks.length === 0 && (
              <div className="loading">No {activeTab.toLowerCase()} tasks found</div>
            )}
            {tasks.map(task => (
              <TaskRow
                key={`${task.taskId}-${task.runId}`}
                task={task}
                isSelected={selectedTaskId === task.taskId}
                onClick={() => handleSelect(task.taskId)}
              />
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
            <TaskDetailPanel
              taskId={selectedTaskId}
              onClose={() => setSelectedTaskId(null)}
              onActionDone={() => load(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
