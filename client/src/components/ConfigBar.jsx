import { useEffect, useState } from 'react';

export default function ConfigBar() {
  const [cfg, setCfg] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => { setCfg(d); setErr(false); })
      .catch(() => setErr(true));
  }, []);

  return (
    <div className="topbar">
      <h1>⚡ Temporal UI</h1>
      {cfg && (
        <span className="conn-info">
          <span>{cfg.address}</span> &nbsp;·&nbsp; ns: <span>{cfg.namespace}</span>
          {cfg.tls?.enabled && <> &nbsp;·&nbsp; <span>TLS</span></>}
        </span>
      )}
      <div className={`dot${err ? ' error' : ''}`} title={err ? 'Cannot reach server' : 'Connected'} />
    </div>
  );
}
