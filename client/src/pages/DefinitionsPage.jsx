import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DefinitionsPage() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/workflow-types')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setTypes(d.workflowTypes || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Workflow Definitions</h2>
        <button className="refresh-btn" onClick={load}>↺ Refresh</button>
      </div>
      <p className="page-subtitle">Click a type to browse its instances</p>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-msg">{error}</div>}
      {!loading && !error && types.length === 0 && (
        <div className="loading">No workflow types found. Ensure Temporal is running with executions.</div>
      )}

      <div className="def-grid">
        {types.map(t => (
          <div
            key={t}
            className="def-card"
            onClick={() => navigate(`/search?type=${encodeURIComponent(t)}`)}
          >
            <div className="def-card-name">{t}</div>
            <div className="def-card-action">Browse instances →</div>
          </div>
        ))}
      </div>
    </div>
  );
}
