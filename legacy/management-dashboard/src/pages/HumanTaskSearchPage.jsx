import { useState, useCallback } from 'react';
import { TaskDetailPanel, TaskRow } from '../components/TaskDetail';
import { listHumanTasks } from '../api/managementApi';

const STATUS_OPTIONS = ['All', 'Pending', 'Completed', 'Failed', 'Canceled'];
const STATUS_MAP = { All: '', Pending: 'Running', Completed: 'Completed', Failed: 'Failed', Canceled: 'Canceled' };

function getDatePreset(preset) {
  const now = new Date();
  if (preset === 'lastHour') return { startTimeFrom: new Date(now - 3600000).toISOString() };
  if (preset === 'today') return { startTimeFrom: now.toISOString().split('T')[0] };
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const d = y.toISOString().split('T')[0];
    return { startTimeFrom: d, startTimeTo: d };
  }
  return {};
}

export default function HumanTaskSearchPage() {
  const [activeTab, setActiveTab] = useState('byId');

  // byId tab
  const [idInput, setIdInput] = useState('');

  // full search tab
  const [statusFilter, setStatusFilter] = useState('All');
  const [taskNameFilter, setTaskNameFilter] = useState('');
  const [parentFilter, setParentFilter] = useState('');
  const [startFrom, setStartFrom] = useState('');
  const [startTo, setStartTo] = useState('');
  const [activePreset, setActivePreset] = useState(null);

  // results
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [nextToken, setNextToken] = useState(null);
  const [prevTokens, setPrevTokens] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Track last search params for pagination
  const [lastParams, setLastParams] = useState({});

  const fetchTasks = useCallback((params, token = null) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    listHumanTasks({ limit: 30, ...params, ...(token ? { pageToken: token } : {}) })
      .then(d => { setResults(d.items || []); setNextToken(d.nextPageToken || null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const buildSearchParams = () => {
    const p = {};
    const statusVal = STATUS_MAP[statusFilter];
    if (statusVal) p.status = statusVal;
    if (taskNameFilter.trim()) p.taskName = taskNameFilter.trim();
    if (parentFilter.trim()) p.parentWorkflowId = parentFilter.trim();
    if (activePreset) {
      Object.assign(p, getDatePreset(activePreset));
    } else {
      if (startFrom) p.startTimeFrom = startFrom;
      if (startTo) p.startTimeTo = startTo;
    }
    return p;
  };

  const handleSearch = () => {
    const params = buildSearchParams();
    setLastParams(params);
    setPrevTokens([]);
    setNextToken(null);
    fetchTasks(params);
  };

  const handleFindById = () => {
    if (!idInput.trim()) return;
    const params = { taskId: idInput.trim() };
    setLastParams(params);
    setPrevTokens([]);
    setNextToken(null);
    fetchTasks(params);
  };

  const goNext = () => { setPrevTokens(p => [...p, nextToken]); fetchTasks(lastParams, nextToken); };
  const goPrev = () => { const t = [...prevTokens]; const prev = t.pop() ?? null; setPrevTokens(t); fetchTasks(lastParams, prev); };

  const setPreset = (p) => {
    setActivePreset(prev => prev === p ? null : p);
    setStartFrom('');
    setStartTo('');
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setResults([]);
    setSearched(false);
    setSelectedTaskId(null);
    setPrevTokens([]);
    setNextToken(null);
  };

  return (
    <div className="page ht-page">
      <div className="page-header">
        <h2 className="page-title">Search Human Tasks</h2>
      </div>

      <div className="ht-layout">
        <div className="ht-list-pane ht-search-pane">
          <div className="tabs">
            <button
              className={`tab-btn${activeTab === 'byId' ? ' active' : ''}`}
              onClick={() => switchTab('byId')}
            >🔍 Find by ID</button>
            <button
              className={`tab-btn${activeTab === 'search' ? ' active' : ''}`}
              onClick={() => switchTab('search')}
            >📋 Search</button>
          </div>

          {activeTab === 'byId' && (
            <div className="tab-content">
              <div className="filter-row">
                <input
                  className="filter-input filter-input-wide"
                  placeholder="Enter Task ID (humantask-…)"
                  value={idInput}
                  onChange={e => setIdInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFindById()}
                />
                <button className="search-btn" onClick={handleFindById}>Find</button>
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="tab-content">
              <div className="filters-body">
                <div className="filter-group">
                  <label className="filter-label">Date Preset</label>
                  <div className="preset-btns">
                    {[['lastHour', 'Last Hour'], ['today', 'Today'], ['yesterday', 'Yesterday']].map(([p, label]) => (
                      <button
                        key={p}
                        className={`preset-btn${activePreset === p ? ' active' : ''}`}
                        onClick={() => setPreset(p)}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                <div className="filter-row">
                  <div className="filter-group">
                    <label className="filter-label">Start From</label>
                    <input
                      className="filter-input"
                      type="date"
                      value={startFrom}
                      onChange={e => { setStartFrom(e.target.value); setActivePreset(null); }}
                    />
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">Start To</label>
                    <input
                      className="filter-input"
                      type="date"
                      value={startTo}
                      onChange={e => { setStartTo(e.target.value); setActivePreset(null); }}
                    />
                  </div>
                </div>

                <div className="filter-row">
                  <div className="filter-group">
                    <label className="filter-label">Status</label>
                    <select
                      className="filter-select"
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">Task Name (type)</label>
                    <input
                      className="filter-input"
                      placeholder="e.g. approveExpense"
                      value={taskNameFilter}
                      onChange={e => setTaskNameFilter(e.target.value)}
                    />
                  </div>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Parent Workflow ID</label>
                  <input
                    className="filter-input filter-input-wide"
                    placeholder="Filter by parent workflow"
                    value={parentFilter}
                    onChange={e => setParentFilter(e.target.value)}
                  />
                </div>

                <button className="search-btn" onClick={handleSearch}>Search</button>
              </div>
            </div>
          )}

          <div className="ht-list-body">
            {loading && <div className="loading">Loading…</div>}
            {error && <div className="error-msg">{error}</div>}
            {searched && !loading && !error && results.length === 0 && (
              <div className="loading">No tasks found</div>
            )}
            {results.map(task => (
              <TaskRow
                key={`${task.taskId}-${task.runId}`}
                task={task}
                isSelected={selectedTaskId === task.taskId}
                onClick={() => setSelectedTaskId(prev => prev === task.taskId ? null : task.taskId)}
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
              onActionDone={() => setSelectedTaskId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
