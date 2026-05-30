import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api.js";

const ENDPOINTS = [
  {
    key: "health",
    label: "Health",
    path: "/api/health",
    description: "Server heartbeat and uptime readiness",
  },
  {
    key: "config",
    label: "Config",
    path: "/api/config",
    description: "Tag/category configuration payload",
  },
  {
    key: "items",
    label: "Wardrobe Items",
    path: "/api/items",
    description: "Current saved wardrobe entries",
  },
  {
    key: "savedOutfits",
    label: "Saved Outfits",
    path: "/api/outfits/saved",
    description: "Persisted outfits from Outfit Builder",
  },
];

function summarizeBody(body) {
  if (Array.isArray(body)) {
    return `Array(${body.length})`;
  }
  if (body && typeof body === "object") {
    const keys = Object.keys(body);
    return `Object { ${keys.slice(0, 6).join(", ")}${keys.length > 6 ? ", ..." : ""} }`;
  }
  return String(body);
}

export default function DiagnosticsPanel() {
  const [enabled, setEnabled] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState(null);
  const [results, setResults] = useState({});

  const totalChecks = ENDPOINTS.length;
  const successCount = useMemo(
    () => Object.values(results).filter((entry) => entry?.status === "ok").length,
    [results],
  );

  async function runDiagnostics() {
    setRunning(true);

    const next = {};
    for (const endpoint of ENDPOINTS) {
      const started = performance.now();
      try {
        const res = await fetch(`${API_BASE}${endpoint.path}`);
        const raw = await res.text();
        let body = raw;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          // Keep plain-text body for diagnostics.
        }

        next[endpoint.key] = {
          status: res.ok ? "ok" : "error",
          code: res.status,
          latencyMs: Math.round(performance.now() - started),
          preview: summarizeBody(body),
        };
      } catch (error) {
        next[endpoint.key] = {
          status: "error",
          code: "network",
          latencyMs: Math.round(performance.now() - started),
          preview: error?.message || "Network error",
        };
      }
    }

    setResults(next);
    setLastRunAt(new Date().toISOString());
    setRunning(false);
  }

  useEffect(() => {
    if (!enabled || !autoRefresh) {
      return undefined;
    }

    runDiagnostics();
    const timer = window.setInterval(() => {
      runDiagnostics();
    }, 20000);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, autoRefresh]);

  return (
    <section className="panel diagnostics-panel">
      <div className="diagnostics-head">
        <div>
          <h2>Diagnostic Mode</h2>
          <p className="meta">Quick API checks for troubleshooting backend responsiveness.</p>
        </div>
        <div className="diagnostics-summary">
          <span>{successCount}/{totalChecks} passing</span>
          {lastRunAt ? <small>Last run: {new Date(lastRunAt).toLocaleTimeString()}</small> : null}
        </div>
      </div>

      <div className="diagnostics-controls">
        <button type="button" onClick={() => setEnabled((prev) => !prev)}>
          {enabled ? "Disable Diagnostic Mode" : "Enable Diagnostic Mode"}
        </button>
        <button type="button" className="secondary-btn" disabled={!enabled || running} onClick={runDiagnostics}>
          {running ? "Running checks..." : "Run Diagnostics"}
        </button>
        <button
          type="button"
          className="secondary-btn"
          disabled={!enabled}
          onClick={() => setAutoRefresh((prev) => !prev)}
        >
          {autoRefresh ? "Auto Refresh: On" : "Auto Refresh: Off"}
        </button>
      </div>

      {!enabled ? (
        <p className="meta">Enable diagnostic mode to inspect API status and latency.</p>
      ) : (
        <div className="diagnostics-grid">
          {ENDPOINTS.map((endpoint) => {
            const info = results[endpoint.key];
            return (
              <article className="diagnostic-card" key={endpoint.key}>
                <header>
                  <h3>{endpoint.label}</h3>
                  <span
                    className={`diagnostic-status ${
                      !info ? "diagnostic-status-idle" : info.status === "ok" ? "diagnostic-status-ok" : "diagnostic-status-error"
                    }`}
                  >
                    {!info ? "idle" : info.status}
                  </span>
                </header>
                <p className="meta">{endpoint.description}</p>
                <dl>
                  <div>
                    <dt>Endpoint</dt>
                    <dd>{endpoint.path}</dd>
                  </div>
                  <div>
                    <dt>HTTP</dt>
                    <dd>{info ? info.code : "-"}</dd>
                  </div>
                  <div>
                    <dt>Latency</dt>
                    <dd>{info ? `${info.latencyMs} ms` : "-"}</dd>
                  </div>
                </dl>
                <p className="diagnostic-preview">{info ? info.preview : "No diagnostic data yet."}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
