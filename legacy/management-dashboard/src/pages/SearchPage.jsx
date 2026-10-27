import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import {
  listWorkflows,
  getDefinitions,
  setRestartDraft,
  getSelectedUser,
  USER_CONTEXT_CHANGED_EVENT,
} from '../api/managementApi';
import { isUserPortalView } from '../utils/portalView';

const STATUS_OPTIONS = ['All', 'Running', 'Completed', 'Failed', 'Canceled', 'Terminated', 'TimedOut'];

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
            <button className="open-detail-btn" onClick={() => onOpenDetail(exec)}>
              Open Full Details →
            </button>
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

export default function SearchPage() {
  const isUserPortal = isUserPortalView();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const typeParam = searchParams.get('type');
  const wfIdParam = searchParams.get('workflowId');
  const autoSearched = useRef(false);

  const [activeTab, setActiveTab] = useState(typeParam ? 'search' : wfIdParam ? 'byId' : 'byId');

  // By ID tab
  const [idInput, setIdInput] = useState(wfIdParam ?? '');

  // Search tab
  const [typeFilter, setTypeFilter] = useState(typeParam ?? '');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startFrom, setStartFrom] = useState('');
  const [startTo, setStartTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(!typeParam);
  const [activePreset, setActivePreset] = useState(null);

  // Results
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextToken, setNextToken] = useState(null);
  const [prevTokens, setPrevTokens] = useState([]);
  const [searched, setSearched] = useState(false);
  const [localTypes, setLocalTypes] = useState(new Set());

  const withStartedByFilter = (params) => {
    if (!isUserPortal) {
      return params;
    }
    const startedBy = getSelectedUser()?.userId;
    return startedBy ? { ...params, startedBy } : params;
  };

  const fetchWorkflows = (params, token = null) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    listWorkflows(withStartedByFilter({ limit: 30, ...params, ...(token ? { pageToken: token } : {}) }))
      .then(d => {
        setResults(d.items || []);
        setNextToken(d.nextPageToken || null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Auto-search when arriving from Definitions with ?type=
  useEffect(() => {
    if (typeParam && !autoSearched.current) {
      autoSearched.current = true;
      setTypeFilter(typeParam);
      setActiveTab('search');
      setFiltersOpen(false);
      fetchWorkflows({ workflowType: typeParam });
    }
  }, [typeParam]);

  // Auto-search when arriving with ?workflowId=
  useEffect(() => {
    if (wfIdParam && !autoSearched.current) {
      autoSearched.current = true;
      setIdInput(wfIdParam);
      setActiveTab('byId');
      fetchWorkflows({ workflowId: wfIdParam });
    }
  }, [wfIdParam]);

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
      setNextToken(null);
      if (!searched) {
        return;
      }
      if (activeTab === 'byId' && idInput.trim()) {
        fetchWorkflows({ workflowId: idInput.trim() });
      } else if (activeTab === 'search') {
        fetchWorkflows(buildSearchParams());
      }
    };
    window.addEventListener(USER_CONTEXT_CHANGED_EVENT, onUserContextChanged);
    return () => window.removeEventListener(USER_CONTEXT_CHANGED_EVENT, onUserContextChanged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searched, idInput, typeFilter, statusFilter, startFrom, startTo, activePreset]);

  const buildSearchParams = () => {
    const p = {};
    if (typeFilter.trim()) p.workflowType = typeFilter.trim();
    if (statusFilter !== 'All') p.status = statusFilter;
    if (activePreset) {
      const now = new Date();
      if (activePreset === 'lastHour') p.startTimeFrom = new Date(now - 3600000).toISOString();
      else if (activePreset === 'today') p.startTimeFrom = now.toISOString().split('T')[0];
      else if (activePreset === 'yesterday') {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        const d = y.toISOString().split('T')[0];
        p.startTimeFrom = d; p.startTimeTo = d;
      }
    } else {
      if (startFrom) p.startTimeFrom = startFrom;
      if (startTo) p.startTimeTo = startTo;
    }
    return p;
  };

  const handleSearch = () => {
    setPrevTokens([]);
    setNextToken(null);
    fetchWorkflows(buildSearchParams());
  };

  const handleFindById = () => {
    if (!idInput.trim()) return;
    setPrevTokens([]);
    setNextToken(null);
    fetchWorkflows({ workflowId: idInput.trim() });
  };

  const goNext = () => {
    setPrevTokens(p => [...p, nextToken]);
    fetchWorkflows(buildSearchParams(), nextToken);
  };

  const goPrev = () => {
    const tokens = [...prevTokens];
    const prev = tokens.pop() ?? null;
    setPrevTokens(tokens);
    fetchWorkflows(buildSearchParams(), prev);
  };

  const openDetail = (exec) => {
    navigate(`/detail/${encodeURIComponent(exec.workflowId)}/${encodeURIComponent(exec.runId)}`);
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setResults([]);
    setSearched(false);
    setPrevTokens([]);
    setNextToken(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Workflow Instances</h2>
      </div>
      {isUserPortal && (
        <p className="page-subtitle">Showing only workflow instances started by the selected user.</p>
      )}

      <div className="tabs">
        <button className={`tab-btn${activeTab === 'byId' ? ' active' : ''}`} onClick={() => switchTab('byId')}>
          🔍 Find by ID
        </button>
        <button className={`tab-btn${activeTab === 'search' ? ' active' : ''}`} onClick={() => switchTab('search')}>
          📋 Search
        </button>
      </div>

      {activeTab === 'byId' && (
        <div className="tab-content">
          <div className="filter-row">
            <input
              className="filter-input filter-input-wide"
              placeholder="Enter Workflow ID"
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
          <div className="filters-toggle" onClick={() => setFiltersOpen(o => !o)}>
            <span>{filtersOpen ? '▲' : '▼'}</span>
            <span>Filters</span>
            {!filtersOpen && typeFilter && (
              <span className="filter-pills">
                <span className="filter-pill">type: {typeFilter}</span>
                {statusFilter !== 'All' && <span className="filter-pill">status: {statusFilter}</span>}
                {startFrom && <span className="filter-pill">from: {startFrom}</span>}
                {startTo && <span className="filter-pill">to: {startTo}</span>}
              </span>
            )}
          </div>

          {filtersOpen && (
            <div className="filters-body">
              <div className="filter-group">
                <label className="filter-label">Date Preset</label>
                <div className="preset-btns">
                  {[['lastHour', 'Last Hour'], ['today', 'Today'], ['yesterday', 'Yesterday']].map(([p, label]) => (
                    <button
                      key={p}
                      className={`preset-btn${activePreset === p ? ' active' : ''}`}
                      onClick={() => { setActivePreset(prev => prev === p ? null : p); setStartFrom(''); setStartTo(''); }}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div className="filter-row">
                <div className="filter-group">
                  <label className="filter-label">Workflow Type</label>
                  <input
                    className="filter-input"
                    placeholder="e.g. processOrder"
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Status</label>
                  <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-label">Start From</label>
                  <input className="filter-input" type="date" value={startFrom}
                    onChange={e => { setStartFrom(e.target.value); setActivePreset(null); }} />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Start To</label>
                  <input className="filter-input" type="date" value={startTo}
                    onChange={e => { setStartTo(e.target.value); setActivePreset(null); }} />
                </div>
              </div>
              <button className="search-btn" onClick={handleSearch}>Search</button>
            </div>
          )}
        </div>
      )}

      <div className="results-section">
        {loading && <div className="loading">Loading…</div>}
        {error && <div className="error-msg">{error}</div>}
        {searched && !loading && !error && results.length === 0 && (
          <div className="loading">No results found</div>
        )}
        {results.map(exec => (
          <ResultRow
            key={`${exec.workflowId}-${exec.runId}`}
            exec={exec}
            canRestart={localTypes.has(exec.workflowType)}
            onOpenDetail={openDetail}
            onRestart={workflow => {
              setRestartDraft({ workflowType: workflow.workflowType, input: workflow.input ?? null });
              navigate(`/definitions?launchType=${encodeURIComponent(workflow.workflowType)}`);
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
