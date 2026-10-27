import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getDefinitions,
  startWorkflow,
  getRestartDraft,
  clearRestartDraft,
} from '../api/managementApi';

function parseInputSchema(inputSchema) {
  if (!inputSchema || typeof inputSchema !== 'string') return null;
  try {
    const parsed = JSON.parse(inputSchema);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeSchemaType(schema) {
  if (!schema || typeof schema !== 'object') return undefined;
  if (Array.isArray(schema.type)) {
    return schema.type.find(t => t !== 'null') || schema.type[0];
  }
  return schema.type;
}

function buildInitialFormValues(schema) {
  const props = schema?.properties;
  if (!props || typeof props !== 'object') return {};

  const values = {};
  for (const [field, fieldSchema] of Object.entries(props)) {
    const type = normalizeSchemaType(fieldSchema);
    if (type === 'boolean') {
      values[field] = fieldSchema.default === true;
      continue;
    }
    if (type === 'array' || type === 'object') {
      values[field] = fieldSchema.default !== undefined
        ? JSON.stringify(fieldSchema.default, null, 2)
        : '';
      continue;
    }
    values[field] = fieldSchema.default !== undefined ? String(fieldSchema.default) : '';
  }

  return values;
}

function buildInputFromForm(schema, formValues) {
  const props = schema?.properties;
  if (!props || typeof props !== 'object') return {};

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const input = {};

  for (const [field, fieldSchema] of Object.entries(props)) {
    const type = normalizeSchemaType(fieldSchema);
    const raw = formValues[field];

    if (type === 'boolean') {
      input[field] = !!raw;
      continue;
    }

    const trimmed = String(raw ?? '').trim();
    if (!trimmed) {
      if (required.has(field)) {
        throw new Error(`Field '${field}' is required`);
      }
      continue;
    }

    if (type === 'number') {
      const n = Number(trimmed);
      if (Number.isNaN(n)) throw new Error(`Field '${field}' must be a number`);
      input[field] = n;
      continue;
    }

    if (type === 'integer') {
      const n = Number(trimmed);
      if (!Number.isInteger(n)) throw new Error(`Field '${field}' must be an integer`);
      input[field] = n;
      continue;
    }

    if (type === 'array' || type === 'object') {
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        throw new Error(`Field '${field}' must be valid JSON`);
      }
      if (type === 'array' && !Array.isArray(parsed)) {
        throw new Error(`Field '${field}' must be a JSON array`);
      }
      if (type === 'object' && (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object')) {
        throw new Error(`Field '${field}' must be a JSON object`);
      }
      input[field] = parsed;
      continue;
    }

    input[field] = trimmed;
  }

  return input;
}

function syncFormValuesFromJson(schema, jsonText, currentValues) {
  const props = schema?.properties;
  if (!props || typeof props !== 'object') return currentValues;

  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return currentValues;
    }

    const nextValues = { ...currentValues };
    for (const [field, fieldSchema] of Object.entries(props)) {
      if (!(field in parsed)) continue;
      const type = normalizeSchemaType(fieldSchema);
      const value = parsed[field];

      if (type === 'boolean') {
        nextValues[field] = !!value;
      } else if (type === 'array' || type === 'object') {
        nextValues[field] = JSON.stringify(value, null, 2);
      } else {
        nextValues[field] = value === null || value === undefined ? '' : String(value);
      }
    }

    return nextValues;
  } catch {
    return currentValues;
  }
}

function LaunchModal({ workflowType, inputSchema, initialInput = null, onClose, onLaunched }) {
  const parsedSchema = useMemo(() => parseInputSchema(inputSchema), [inputSchema]);
  const formSchema = useMemo(() => {
    if (!parsedSchema) return null;
    if (normalizeSchemaType(parsedSchema) === 'object' || parsedSchema.properties) return parsedSchema;
    return null;
  }, [parsedSchema]);

  const [activeTab, setActiveTab] = useState(formSchema ? 'form' : 'json');
  const [inputJson, setInputJson] = useState('{\n  \n}');
  const [formValues, setFormValues] = useState(() => buildInitialFormValues(formSchema));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const initialValues = buildInitialFormValues(formSchema);
    let mergedFormValues = initialValues;

    if (initialInput && formSchema && typeof initialInput === 'object' && !Array.isArray(initialInput)) {
      const merged = { ...initialValues };
      for (const [field, fieldSchema] of formFields) {
        if (!(field in initialInput)) continue;
        const type = normalizeSchemaType(fieldSchema);
        const value = initialInput[field];
        if (type === 'boolean') {
          merged[field] = !!value;
        } else if (type === 'array' || type === 'object') {
          merged[field] = JSON.stringify(value, null, 2);
        } else {
          merged[field] = value === null || value === undefined ? '' : String(value);
        }
      }
      mergedFormValues = merged;
    }

    setFormValues(mergedFormValues);
    if (formSchema) {
      try {
        const computedInitialInput = buildInputFromForm(formSchema, mergedFormValues);
        setInputJson(JSON.stringify(computedInitialInput, null, 2));
      } catch {
        setInputJson(initialInput ? JSON.stringify(initialInput, null, 2) : '{\n  \n}');
      }
      setActiveTab('form');
    } else {
      setInputJson(initialInput ? JSON.stringify(initialInput, null, 2) : '{\n  \n}');
      setActiveTab('json');
    }
    setError(null);
    setSuccess(null);
  }, [formSchema, workflowType, initialInput]);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;

    if (tab === 'json' && formSchema) {
      try {
        const next = buildInputFromForm(formSchema, formValues);
        setInputJson(JSON.stringify(next, null, 2));
      } catch {
        // Keep current JSON when form values are incomplete.
      }
    }

    if (tab === 'form' && formSchema) {
      setFormValues(prev => syncFormValuesFromJson(formSchema, inputJson, prev));
    }

    setActiveTab(tab);
    setError(null);
  };

  const handleFormChange = (field, value) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const formFields = formSchema?.properties ? Object.entries(formSchema.properties) : [];

  const handleLaunch = async () => {
    let input;

    try {
      if (activeTab === 'form' && formSchema) {
        input = buildInputFromForm(formSchema, formValues);
      } else {
        input = JSON.parse(inputJson);
      }
    } catch (e) {
      setError(e.message || 'Invalid input');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data = await startWorkflow({ workflowType, input });
      setSuccess(data.workflowId || 'Workflow started');
      if (onLaunched) onLaunched(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-title-icon">▶</span>
            Launch <span className="modal-wf-type">{workflowType}</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className="modal-success">
            <div className="modal-success-icon">✓</div>
            <div className="modal-success-msg">Workflow started</div>
            <div className="modal-success-id">{success}</div>
            <div className="modal-success-actions">
              <button className="search-btn" onClick={onClose}>Done</button>
              <button className="back-btn" onClick={() => setSuccess(null)}>Launch Another</button>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-body">
              <div className="tabs modal-tabs" style={{ borderBottom: 'none', marginBottom: 0 }}>
                <button
                  className={`tab-btn${activeTab === 'form' ? ' active' : ''}`}
                  disabled={!formSchema}
                  onClick={() => handleTabChange('form')}
                  title={formSchema ? 'Schema-driven form input' : 'Schema not available for this workflow'}
                >
                  Form
                </button>
                <button
                  className={`tab-btn${activeTab === 'json' ? ' active' : ''}`}
                  onClick={() => handleTabChange('json')}
                >
                  JSON
                </button>
              </div>

              {activeTab === 'form' && formSchema && (
                <div className="modal-section">
                  <div className="modal-label">Workflow Input Form</div>
                  <div className="modal-form-grid">
                    {formFields.map(([field, fieldSchema]) => {
                      const type = normalizeSchemaType(fieldSchema);
                      const isRequired = Array.isArray(formSchema.required) && formSchema.required.includes(field);
                      const description = fieldSchema?.description;

                      return (
                        <div key={field} className="modal-form-field">
                          <label className="filter-label">
                            {field}{isRequired ? ' *' : ''}
                          </label>

                          {type === 'boolean' ? (
                            <label className="modal-check-row">
                              <input
                                type="checkbox"
                                checked={!!formValues[field]}
                                onChange={(e) => handleFormChange(field, e.target.checked)}
                              />
                              <span>{description || 'Enabled'}</span>
                            </label>
                          ) : (type === 'array' || type === 'object') ? (
                            <textarea
                              className="result-textarea modal-field-textarea"
                              value={formValues[field] ?? ''}
                              placeholder={type === 'array' ? '[]' : '{}'}
                              onChange={(e) => handleFormChange(field, e.target.value)}
                              rows={4}
                              spellCheck={false}
                            />
                          ) : (
                            <input
                              className="filter-input"
                              type={(type === 'number' || type === 'integer') ? 'number' : 'text'}
                              value={formValues[field] ?? ''}
                              placeholder={fieldSchema?.default !== undefined ? String(fieldSchema.default) : ''}
                              onChange={(e) => handleFormChange(field, e.target.value)}
                            />
                          )}

                          {description && type !== 'boolean' && (
                            <div className="modal-field-help">{description}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'json' && (
                <div className="modal-section">
                  <div className="modal-label">Input JSON</div>
                  <textarea
                    className="result-textarea modal-textarea"
                    value={inputJson}
                    onChange={e => { setInputJson(e.target.value); setError(null); }}
                    rows={8}
                    spellCheck={false}
                  />
                </div>
              )}

              {!formSchema && (
                <div className="modal-field-help">
                  Input schema is not available from the Management API for this workflow yet. Use the JSON tab.
                </div>
              )}
            </div>

            {error && <div className="complete-error modal-error">{error}</div>}

            <div className="modal-footer">
              <button className="search-btn" onClick={handleLaunch} disabled={submitting}>
                {submitting ? 'Starting…' : '▶ Start Workflow'}
              </button>
              <button className="back-btn" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function DefinitionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [defs, setDefs] = useState([]);
  const [allDefs, setAllDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [launchDef, setLaunchDef] = useState(null);

  const load = useCallback((p, f, s) => {
    setLoading(true);
    setError(null);
    getDefinitions()
      .then(d => {
        let list = d.definitions || [];
        setAllDefs(list);
        if (s) list = list.filter(x => x.workflowType.toLowerCase().includes(s.toLowerCase()));
        if (f === 'Active') list = list.filter(x => x.isActive);
        if (f === 'Inactive') list = list.filter(x => !x.isActive);
        list.sort((a, b) => a.workflowType.localeCompare(b.workflowType));
        setTotal(list.length);
        setDefs(list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (allDefs.length === 0) return;
    const launchType = searchParams.get('launchType');
    if (!launchType) return;

    const matched = allDefs.find(def => def.workflowType === launchType);
    if (!matched) {
      setError(`Workflow type '${launchType}' is from another integration. Launch/restart form is only available for local definitions.`);
      clearRestartDraft();
      const next = new URLSearchParams(searchParams);
      next.delete('launchType');
      setSearchParams(next, { replace: true });
      return;
    }

    const draft = getRestartDraft();
    const initialInput = draft?.workflowType === launchType ? draft.input : null;
    setLaunchDef({ ...matched, initialInput });
    clearRestartDraft();
    const next = new URLSearchParams(searchParams);
    next.delete('launchType');
    setSearchParams(next, { replace: true });
  }, [allDefs, searchParams, setSearchParams]);

  useEffect(() => { load(1, filter, appliedSearch); }, [filter, appliedSearch, load]);

  const handleSearch = () => {
    setAppliedSearch(searchInput);
    setPage(1);
  };

  const goPage = (p) => {
    setPage(p);
    load(p, filter, appliedSearch);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Workflow Definitions</h2>
        <span className="type-count">{total} type{total !== 1 ? 's' : ''}</span>
        <button className="refresh-btn" onClick={() => load(page, filter, appliedSearch)}>↺ Refresh</button>
      </div>

      <div className="def-controls">
        <div className="tabs" style={{ borderBottom: 'none', marginBottom: 0 }}>
          {['All', 'Active', 'Inactive'].map(f => (
            <button key={f} className={`tab-btn${filter === f ? ' active' : ''}`}
              onClick={() => { setFilter(f); setPage(1); }}>
              {f}
            </button>
          ))}
        </div>
        <div className="def-search-row">
          <input
            className="filter-input"
            placeholder="Search by name…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="search-btn" onClick={handleSearch}>Search</button>
        </div>
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-msg">{error}</div>}

      {!loading && !error && (
        <>
          <div className="def-flat-list">
            {defs.length === 0 && <div className="loading">No workflow definitions found.</div>}
            {defs.map(def => (
              <div key={def.workflowType} className="def-flat-row">
                <span
                  className={`worker-dot ${def.isActive ? 'active' : 'inactive'}`}
                  title={def.isActive ? `${def.workerCount} active worker(s)` : 'No active workers'}
                />
                <div className="def-flat-info" onClick={() => navigate(`/search?type=${encodeURIComponent(def.workflowType)}`)}>
                  <span className="def-flat-name">{def.workflowType}</span>
                  <span className="def-flat-meta">
                    <span className="def-flat-queue">{def.taskQueue}</span>
                    <span className={`worker-label ${def.isActive ? 'active' : 'inactive'}`}>
                      {def.isActive ? `${def.workerCount} worker${def.workerCount !== 1 ? 's' : ''}` : 'No Workers'}
                    </span>
                  </span>
                </div>
                <button
                  className="def-launch-btn-inline"
                  disabled={!def.isActive}
                  onClick={() => setLaunchDef(def)}
                  title={def.isActive ? `Launch ${def.workflowType}` : 'No active workers — cannot launch'}
                >
                  ▶ Launch
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" disabled={page <= 1} onClick={() => goPage(page - 1)}>← Prev</button>
              <span className="page-info">Page {page} of {totalPages}</span>
              <button className="page-btn" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {launchDef && (
        <LaunchModal
          workflowType={launchDef.workflowType}
          inputSchema={launchDef.inputSchema}
          initialInput={launchDef.initialInput || null}
          onClose={() => setLaunchDef(null)}
          onLaunched={(data) => {
            setLaunchDef(null);
            if (data?.workflowId) {
              navigate(`/search?workflowId=${encodeURIComponent(data.workflowId)}`);
            }
          }}
        />
      )}
    </div>
  );
}
