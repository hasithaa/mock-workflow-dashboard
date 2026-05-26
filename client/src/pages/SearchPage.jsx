import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';

const STATUS_OPTIONS = ['All', 'Running', 'Completed', 'Failed', 'Canceled', 'Terminated', 'TimedOut'];

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function ResultRow({ exec, onOpenDetail }) {
  const [expanded, setExpanded] = useState(false);
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
            <div><span className="rd-label">Task Queue</span><span className="rd-value">{exec.taskQueue || '—'}</span></div>
            <div><span className="rd-label">History</span><span className="rd-value">{exec.historyLength} events</span></div>
          </div>
          <button className="open-detail-btn" onClick={() => onOpenDetail(exec)}>
            Open Full Details →
          </button>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const typeParam = searchParams.get('type');
  const autoSearched = useRef(false);

  const [activeTab, setActiveTab] = useState(typeParam ? 'search' : 'byId');

  // By ID tab
  const [idInput, setIdInput] = useState('');

  // Search tab
  const [typeFilter, setTypeFilter] = useState(typeParam ?? '');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startFrom, setStartFrom] = useState('');
  const [startTo, setStartTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(!typeParam);

  // Results
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextToken, setNextToken] = useState(null);
  const [prevTokens, setPrevTokens] = useState([]);
  const [searched, setSearched] = useState(false);

  const fetchWorkflows = (params, token = null) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    const p = new URLSearchParams({ pageSize: 30, ...params });
    if (token) p.set('nextPageToken', token);
    fetch(`/api/workflows?${p}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setResults(d.executions || []);
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

  const buildSearchParams = () => {
    const p = {};
    if (typeFilter.trim()) p.workflowType = typeFilter.trim();
    if (statusFilter !== 'All') p.status = statusFilter;
    if (startFrom) p.startTimeFrom = startFrom;
    if (startTo) p.startTimeTo = startTo;
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
                  <input className="filter-input" type="date" value={startFrom} onChange={e => setStartFrom(e.target.value)} />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Start To</label>
                  <input className="filter-input" type="date" value={startTo} onChange={e => setStartTo(e.target.value)} />
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
            onOpenDetail={openDetail}
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
