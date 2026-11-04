import { useMemo, useState } from "react";
import { useApp } from "./store.js";
import { AreaChart } from "./charts.jsx";
import { formatWhen, statusForReading } from "./data.js";
import { Icon } from "./icons.jsx";

function Header({ kicker, title, text, children }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{kicker}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}

function Pill({ tone = "normal", children, pulse = false }) {
  return (
    <span className={`pill ${tone}`}>
      <i className={`dot ${pulse ? "pulse" : ""}`} />
      {children}
    </span>
  );
}

function Delta({ value, down = false, label = "vs last hour" }) {
  return (
    <div className="metric-foot">
      <span className={down ? "delta down" : "delta up"}>
        <Icon name={down ? "arrowDown" : "arrowUp"} size={14} />
        {value}
      </span>
      <span>{label}</span>
    </div>
  );
}

function chartSeries(readings, bucketMs = 0) {
  const ordered = [...readings].sort((a, b) => a.at - b.at);
  if (bucketMs) {
    const buckets = new Map();
    ordered.forEach((row) => {
      const start = Math.floor(row.at.getTime() / bucketMs) * bucketMs;
      const bucket = buckets.get(start) || { temp: [], hum: [], at: new Date(start) };
      bucket.temp.push(row.temp);
      bucket.hum.push(row.hum);
      buckets.set(start, bucket);
    });
    return {
      temp: [...buckets.values()].map((bucket) => bucket.temp.reduce((sum, value) => sum + value, 0) / bucket.temp.length),
      hum: [...buckets.values()].map((bucket) => bucket.hum.reduce((sum, value) => sum + value, 0) / bucket.hum.length),
      labels: [...buckets.values()].map((bucket) =>
        bucket.at.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric" })
      ),
    };
  }
  return {
    temp: ordered.map((row) => row.temp),
    hum: ordered.map((row) => row.hum),
    labels: ordered.map((row) =>
      row.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    ),
  };
}

function delta(current, previous, unit) {
  if (current == null || previous == null) return null;
  const change = Math.round((current - previous) * 10) / 10;
  const sign = change > 0 ? "+" : "";
  return { text: `${sign}${change}${unit}`, down: change < 0 };
}

export function DashboardPage() {
  const { readings, alerts, latest, settings, firebaseConnected, setPage } = useApp();
  const series = chartSeries(readings);
  const avg = readings.length
    ? (readings.reduce((sum, row) => sum + row.temp, 0) / readings.length).toFixed(1)
    : null;
  const previous = readings[1];
  const tempChange = delta(latest?.temp, previous?.temp, "°C");
  const humChange = delta(latest?.hum, previous?.hum, "%");
  const status = latest ? statusForReading(latest, readings, settings) : "No data";

  return (
    <>
      <Header
        kicker="System overview"
        title="Temperature & Humidity Monitoring"
        text="Readings show up here once a station sends them."
      />

      <div className="strip">
        <div>
          <span className="soft-icon">
            <Icon name="chip" />
          </span>
          <div>
            <span>Station</span>
            <strong>{latest ? "Reporting" : "Not connected"}</strong>
          </div>
        </div>
        <div>
          <span className="soft-icon">
            <Icon name="cloud" />
          </span>
          <div>
            <span>Firebase</span>
            <strong>{firebaseConnected ? "Connected" : "Not connected"}</strong>
          </div>
        </div>
        <div>
          <span className="soft-icon">
            <Icon name="refresh" />
          </span>
          <div>
            <span>Last synchronization</span>
            <strong>{latest ? formatWhen(latest.at) : "No sync yet"}</strong>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        <article className="card metric">
          <span className="m-icon orange">
            <Icon name="thermo" />
          </span>
          <span className="m-label">Current Temperature</span>
          <div className="m-value">
            {latest ? latest.temp.toFixed(1) : "—"}
            {latest && <small>°C</small>}
          </div>
          {tempChange && <Delta value={tempChange.text} down={tempChange.down} label="vs previous" />}
        </article>
        <article className="card metric">
          <span className="m-icon blue">
            <Icon name="drop" />
          </span>
          <span className="m-label">Current Humidity</span>
          <div className="m-value">
            {latest ? latest.hum : "—"}
            {latest && <small>%</small>}
          </div>
          {humChange && <Delta value={humChange.text} down={humChange.down} label="vs previous" />}
        </article>
        <article className="card metric">
          <span className="m-icon purple">
            <Icon name="chart" />
          </span>
          <span className="m-label">Average Temperature</span>
          <div className="m-value">
            {avg ?? "—"}
            {avg && <small>°C</small>}
          </div>
        </article>
        <article className="card metric">
          <span className="m-icon green">
            <Icon name="shield" />
          </span>
          <span className="m-label">Environmental Status</span>
          <div className="m-value word">{status}</div>
          {latest && (
            <div className="metric-foot">
              <Pill tone={status.toLowerCase()}>{status}</Pill>
            </div>
          )}
        </article>
      </div>

      <div className="split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2>Temperature trend</h2>
              <p>From received readings</p>
            </div>
            <div className="chart-stat">
              <b>{latest ? `${latest.temp.toFixed(1)}°C` : "—"}</b>
              <span>Current</span>
            </div>
          </div>
          <ReadingChart data={series.temp} labels={series.labels} color="#1c8a62" unit="°C" />
        </section>
        <section className="card">
          <div className="section-head">
            <div>
              <h2>Humidity trend</h2>
              <p>From received readings</p>
            </div>
            <div className="chart-stat blue">
              <b>{latest ? `${latest.hum}%` : "—"}</b>
              <span>Current</span>
            </div>
          </div>
          <ReadingChart data={series.hum} labels={series.labels} color="#3b82b9" unit="%" />
        </section>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Recent alerts</h2>
            <p>Latest system events and notifications</p>
          </div>
          <button className="text-btn" onClick={() => setPage("alerts")}>
            View all <Icon name="chevron" size={15} />
          </button>
        </div>
        <AlertList items={alerts.slice(0, 3)} />
      </section>
    </>
  );
}

function ReadingChart({ data, labels, color, unit, height }) {
  if (!data.length) return <p className="empty-copy">No readings yet.</p>;
  return <AreaChart data={data} labels={labels} color={color} unit={unit} height={height} />;
}

export function LivePage() {
  const { readings, latest, settings } = useApp();
  const series = chartSeries(readings);
  const status = latest ? statusForReading(latest, readings, settings).toUpperCase() : "NO DATA";
  const tempPct = latest ? Math.min(100, Math.max(4, ((latest.temp - 10) / 30) * 100)) : 0;
  const humPct = latest ? Math.min(100, Math.max(4, latest.hum)) : 0;

  return (
    <>
      <Header
        kicker="Real-time sensor feed"
        title="Live Monitoring"
        text="This view stays empty until a sensor publishes a reading."
      >
        <span className="live-badge">{latest ? "LIVE" : "IDLE"}</span>
      </Header>
      <div className="live-bar">
        <span>{latest ? "Station reporting" : "Station offline"}</span>
        <span>
          <Icon name="clock" size={15} /> Last reading: {latest ? formatWhen(latest.at) : "None"}
        </span>
      </div>
      <div className="gauge-grid">
        <Gauge title="Temperature" value={latest ? latest.temp.toFixed(1) : "—"} unit={latest ? "°C" : ""} pct={tempPct} tone="orange" state={status} />
        <Gauge title="Relative Humidity" value={latest ? latest.hum : "—"} unit={latest ? "%" : ""} pct={humPct} tone="blue" state={status} />
      </div>
      <section className="card">
        <div className="section-head">
          <div>
            <h2>Live sensor readings</h2>
            <p>Temperature and humidity on the same window</p>
          </div>
          <div className="legend">
            <span>
              <i className="swatch green" /> Temperature
            </span>
            <span>
              <i className="swatch blue" /> Humidity
            </span>
          </div>
        </div>
        <div className="overlay">
          <ReadingChart data={series.temp} labels={series.labels} color="#1c8a62" unit="°C" height={190} />
          {series.hum.length > 0 && (
            <div className="overlay-hum">
              <AreaChart data={series.hum} labels={series.labels} color="#3b82b9" unit="%" height={190} />
            </div>
          )}
        </div>
      </section>
      <div className="led-grid">
        <article className="card led-card">
          <i className="led green" />
          <div>
            <strong>Normal condition</strong>
            <span>All readings within thresholds</span>
          </div>
        </article>
        <article className="card led-card">
          <i className="led yellow" />
          <div>
            <strong>Preliminary warning</strong>
            <span>Single abnormal reading detected</span>
          </div>
        </article>
        <article className="card led-card">
          <i className="led red" />
          <div>
            <strong>Confirmed abnormal</strong>
            <span>Two consecutive abnormal readings</span>
          </div>
        </article>
      </div>
    </>
  );
}

function Gauge({ title, value, unit, pct, tone, state }) {
  return (
    <section className="card gauge">
      <span className={`m-icon ${tone}`}>
        <Icon name={tone === "orange" ? "thermo" : "drop"} />
      </span>
      <span className="m-label">{title}</span>
      <div className="m-value">
        {value}
        <small>{unit}</small>
      </div>
      <div className="track">
        <div className={tone} style={{ width: `${pct}%` }} />
      </div>
      <div className="range">
        <span>Low</span>
        <b>
          <i className={`dot ${state === "NORMAL" ? "" : "warn"}`} /> {state}
        </b>
        <span>High</span>
      </div>
    </section>
  );
}

const RANGE_MS = {
  "By hour": 60 * 60 * 1000,
  "24 hours": 24 * 60 * 60 * 1000,
  Week: 7 * 24 * 60 * 60 * 1000,
  Month: 30 * 24 * 60 * 60 * 1000,
};

const RANGE_BUCKETS = {
  "By hour": 5 * 60 * 1000,
  "24 hours": 60 * 60 * 1000,
  Week: 24 * 60 * 60 * 1000,
  Month: 24 * 60 * 60 * 1000,
};

export function AnalyticsPage() {
  const { historyReadings, settings } = useApp();
  const [range, setRange] = useState("Week");
  const [tab, setTab] = useState("Overview");
  const cutoff = Date.now() - (RANGE_MS[range] || RANGE_MS.Week);
  const rows = historyReadings.filter((row) => row.at.getTime() >= cutoff);
  const series = chartSeries(rows, RANGE_BUCKETS[range]);
  const temps = rows.map((row) => row.temp);
  const hums = rows.map((row) => row.hum);
  const showTemp = tab !== "Humidity";
  const showHum = tab !== "Temperature";
  const avg = temps.length ? `${(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)}°C` : "—";
  const min = temps.length ? `${Math.min(...temps).toFixed(1)}°C` : "—";
  const max = temps.length ? `${Math.max(...temps).toFixed(1)}°C` : "—";
  const hum = hums.length ? `${Math.round(hums.reduce((a, b) => a + b, 0) / hums.length)}%` : "—";
  const statuses = rows.reduce((counts, row) => {
    const status = statusForReading(row, rows, settings);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  const recent = rows.slice(0, 5);
  const trend = recent.length >= 2
    ? (recent[0].temp - recent[recent.length - 1].temp) / (recent.length - 1)
    : 0;
  const projected = recent.length ? recent[0].temp + trend * 6 : null;
  const recommendation = !rows.length
    ? "Recommendations appear once sensor readings arrive."
    : statuses.Alert
      ? "Investigate the station immediately and check ventilation or heat sources."
      : statuses.Warning
        ? "Conditions are approaching a limit. Monitor the next readings closely."
        : "Conditions are stable. Continue monitoring for changes.";

  return (
    <>
      <Header kicker="Sensor intelligence" title="Analytics" text="Understand patterns, diagnose events, and plan ahead.">
        <div className="segmented">
          {Object.keys(RANGE_MS).map((key) => (
            <button key={key} className={range === key ? "active" : ""} onClick={() => setRange(key)}>
              {key}
            </button>
          ))}
        </div>
      </Header>
      <div className="tabs">
        {["Overview", "Temperature", "Humidity", "Comparisons"].map((name) => (
          <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>
            {name}
          </button>
        ))}
      </div>
      <section className="card">
        <div className="section-head">
          <div>
            <h2>{tab === "Comparisons" ? "Temperature vs humidity" : "Descriptive analytics"}</h2>
            <p>Summary statistics for the last {range}</p>
          </div>
        </div>
        <div className="stats-row">
          {showTemp && (
            <>
              <Stat label="Average temp." value={avg} note={temps.length ? `${temps.length} readings` : "No readings"} />
              <Stat label="Minimum temp." value={min} note={temps.length ? "In selected range" : "No readings"} tone="blue" />
              <Stat label="Maximum temp." value={max} note={temps.length ? "In selected range" : "No readings"} tone="orange" />
            </>
          )}
          {showHum && <Stat label="Avg. humidity" value={hum} note={hums.length ? `${hums.length} readings` : "No readings"} tone="purple" />}
        </div>
        {showTemp && <ReadingChart data={series.temp} labels={series.labels} color="#1c8a62" unit="°C" height={200} />}
        {showHum && tab !== "Overview" && (
          <ReadingChart data={series.hum} labels={series.labels} color="#3b82b9" unit="%" height={tab === "Comparisons" ? 140 : 200} />
        )}
      </section>
      <div className="split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2>Diagnostic analytics</h2>
              <p>Unusual readings and possible causes</p>
            </div>
          </div>
          {rows.length ? (
            <div className="insights">
              <p><b>{statuses.Alert || 0}</b> alert readings, <b>{statuses.Warning || 0}</b> warning readings, and <b>{statuses.Normal || 0}</b> normal readings.</p>
              <p>Status comes from the ESP32: below 30°C and below 70% humidity is normal, below 35°C and below 80% humidity is warning, otherwise it is alert.</p>
            </div>
          ) : <p className="empty-copy">No Firebase history exists in the selected range. Keep the dashboard connected until the configured history interval saves a snapshot.</p>}
        </section>
        <section className="card">
          <div className="section-head">
            <div>
              <h2>Predictive analytics</h2>
              <p>Estimated trend · Next 6 readings</p>
            </div>
          </div>
          {projected == null ? (
            <p className="empty-copy">A forecast needs Firebase history in the selected range.</p>
          ) : (
            <div className="insights">
              <p>At the current trend, temperature may reach <b>{projected.toFixed(1)}°C</b> in approximately 6 readings.</p>
              <p>Trend: <b>{trend > 0 ? "+" : ""}{trend.toFixed(1)}°C per reading</b>.</p>
            </div>
          )}
        </section>
      </div>
      <section className="card">
        <div className="section-head">
          <div>
            <h2>Prescriptive recommendations</h2>
            <p>Actions based on current conditions and forecast</p>
          </div>
        </div>
        <p className="empty-copy">{recommendation} When the ESP32 reports ALERT, notify authorized staff to turn on the air conditioner or increase ventilation.</p>
      </section>
    </>
  );
}

function Stat({ label, value, note, tone = "" }) {
  return (
    <div className={`stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

export function HistoryPage() {
  const { readings, settings, toast } = useApp();
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("all");
  const [status, setStatus] = useState("All statuses");
  const [page, setPage] = useState(1);
  const [openRow, setOpenRow] = useState(null);
  const perPage = 8;

  const rows = useMemo(() => {
    const limit = range === "all" ? Infinity : Number(range) * 24 * 60 * 60 * 1000;
    return readings
      .filter((row) => Date.now() - row.at.getTime() <= limit)
      .map((row) => ({ ...row, liveStatus: statusForReading(row, readings, settings), label: formatWhen(row.at) }))
      .filter((row) => {
        const blob = `${row.label} ${row.device || ""} ${row.liveStatus}`.toLowerCase();
        if (query && !blob.includes(query.toLowerCase())) return false;
        if (status !== "All statuses" && row.liveStatus !== status) return false;
        return true;
      });
  }, [readings, query, status, range, settings]);

  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage = Math.min(page, pages);
  const view = rows.slice((safePage - 1) * perPage, safePage * perPage);

  function exportCsv() {
    const header = "Date,Temperature C,Humidity %,Status,Device";
    const body = rows.map((r) => `${r.label},${r.temp},${r.hum},${r.liveStatus},${r.device}`).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "temptrack-history.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV export prepared");
  }

  return (
    <>
      <Header kicker="Sensor records" title="Historical Data" text="Search, filter, and export archived environmental readings.">
        <button className="btn primary" onClick={exportCsv}>
          <Icon name="download" size={16} /> Export CSV
        </button>
      </Header>
      <section className="card">
        <div className="filters">
          <label className="search">
            <Icon name="search" size={16} />
            <input
              value={query}
              placeholder="Search records or device ID…"
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="select">
            <Icon name="calendar" size={16} />
            <select
              value={range}
              onChange={(e) => {
                setRange(e.target.value);
                setPage(1);
              }}
            >
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All records</option>
            </select>
          </label>
          <label className="select">
            <Icon name="filter" size={16} />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {["All statuses", "Normal", "Warning", "Alert"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date & time</th>
                <th>Temperature</th>
                <th>Humidity</th>
                <th>Status</th>
                <th>Device ID</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {view.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty">
                    {readings.length ? "No records match those filters." : "No records yet."}
                  </td>
                </tr>
              )}
              {view.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{row.temp.toFixed(1)}°C</td>
                  <td>{row.hum}%</td>
                  <td>
                    <Pill tone={row.liveStatus.toLowerCase()}>{row.liveStatus}</Pill>
                  </td>
                  <td>{row.device || "—"}</td>
                  <td className="menu-cell">
                    <button aria-label="Row actions" onClick={() => setOpenRow(openRow === row.id ? null : row.id)}>
                      <Icon name="dots" size={16} />
                    </button>
                    {openRow === row.id && (
                      <div className="row-menu">
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(`${row.label} · ${row.temp}°C · ${row.hum}%`);
                            toast("Reading copied");
                            setOpenRow(null);
                          }}
                        >
                          Copy reading
                        </button>
                        <button
                          onClick={() => {
                            toast(`${row.device} · ${row.liveStatus}`);
                            setOpenRow(null);
                          }}
                        >
                          Device detail
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <span>
            Showing {view.length ? (safePage - 1) * perPage + 1 : 0}–{(safePage - 1) * perPage + view.length} of {rows.length} records
          </span>
          <div>
            <button disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
              Previous
            </button>
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} className={safePage === i + 1 ? "active" : ""} onClick={() => setPage(i + 1)}>
                {i + 1}
              </button>
            ))}
            <button disabled={safePage === pages} onClick={() => setPage(safePage + 1)}>
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export function AlertsPage() {
  const { alerts, markAllRead, markRead, readAlerts } = useApp();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("new");
  const items = alerts
    .filter((alert) => (filter === "all" ? true : alert.level === filter))
    .sort((a, b) => (sort === "new" ? b.at - a.at : a.at - b.at));
  const counts = {
    alert: alerts.filter((alert) => alert.level === "alert").length,
    warning: alerts.filter((alert) => alert.level === "warning").length,
    resolved: alerts.filter((alert) => alert.level === "resolved").length,
  };

  return (
    <>
      <Header kicker="Event center" title="Alerts & Notifications" text="Review abnormal readings, system events, and resolutions.">
        <button className="btn ghost" onClick={markAllRead}>
          <Icon name="check" size={16} /> Mark all as read
        </button>
      </Header>
      <div className="summary">
        <article className="card">
          <span className="sum alert">
            <Icon name="alert" />
          </span>
          <div>
            <strong>{counts.alert}</strong>
            <span>Alerts</span>
          </div>
          <small>Requires attention</small>
        </article>
        <article className="card">
          <span className="sum warning">
            <Icon name="alert" />
          </span>
          <div>
            <strong>{counts.warning}</strong>
            <span>Warnings</span>
          </div>
          <small>Preliminary events</small>
        </article>
        <article className="card">
          <span className="sum resolved">
            <Icon name="check" />
          </span>
          <div>
            <strong>{counts.resolved}</strong>
            <span>Resolved</span>
          </div>
          <small>Recent history</small>
        </article>
      </div>
      <section className="card">
        <div className="toolbar">
          <div className="tabs">
            {[
              ["all", "All alerts"],
              ["alert", "Alerts"],
              ["warning", "Warnings"],
              ["resolved", "Resolved"],
            ].map(([id, label]) => (
              <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
          <label className="select compact">
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
            </select>
          </label>
        </div>
        <AlertList items={items} readAlerts={readAlerts} onOpen={markRead} />
      </section>
      <section className="card logic">
        <div className="section-head">
          <div>
            <h2>Alert logic</h2>
            <p>How TEMPTRACK classifies incoming readings</p>
          </div>
        </div>
        <div className="steps">
          <span>
            <i className="led green" /> <b>Normal</b>
            <small>Within range</small>
          </span>
          <Icon name="chevron" size={16} />
          <span>
            <i className="led yellow" /> <b>Warning</b>
            <small>Outside the normal range for 3 minutes</small>
          </span>
          <Icon name="chevron" size={16} />
          <span>
            <i className="led red" /> <b>Alert</b>
            <small>ESP32 reports ALERT</small>
          </span>
        </div>
      </section>
    </>
  );
}

function AlertList({ items, readAlerts, onOpen }) {
  if (!items.length) return <p className="empty-copy">No alerts yet.</p>;
  return (
    <div className="alerts">
      {items.map((alert) => (
        <button key={alert.id} className={`alert ${readAlerts?.has(alert.id) ? "read" : ""}`} onClick={() => onOpen?.(alert.id)}>
          <span className={`symbol ${alert.level}`}>
            <Icon name={alert.level === "resolved" ? "check" : "alert"} size={16} />
          </span>
          <span className="copy">
            <strong>{alert.title}</strong>
            <span>{alert.detail}</span>
          </span>
          <span className="meta">
            <Pill tone={alert.level}>{alert.level}</Pill>
            <time>{alert.time}</time>
          </span>
        </button>
      ))}
    </div>
  );
}

const DEVICE_FIELDS = ["Device name", "Microcontroller", "Sensor", "IP address", "MAC address"];

export function DevicesPage() {
  const { toast } = useApp();
  const [spin, setSpin] = useState(false);

  function refresh() {
    setSpin(true);
    setTimeout(() => {
      setSpin(false);
      toast("No device is reporting");
    }, 400);
  }

  return (
    <>
      <Header kicker="Hardware & connectivity" title="Device Management" text="Monitor your connected station, sensor, and data services.">
        <button className="btn primary" onClick={refresh}>
          <Icon name="refresh" size={16} /> {spin ? "Refreshing…" : "Refresh status"}
        </button>
      </Header>
      <section className="card hero-device">
        <div className="device-art" aria-hidden="true">
          <Icon name="chip" size={28} />
          <i /><i /><i />
        </div>
        <div>
          <Pill tone="warning">Offline</Pill>
          <h2>No station connected</h2>
          <p>Device details appear when a node checks in.</p>
        </div>
      </section>
      <div className="metric-grid">
        <article className="card device-stat">
          <span className="m-icon green"><Icon name="activity" /></span>
          <div>
            <span>Wi-Fi signal</span>
            <strong>—</strong>
            <small>Not reported</small>
          </div>
        </article>
        <article className="card device-stat">
          <span className="m-icon blue"><Icon name="cloud" /></span>
          <div>
            <span>Firebase sync</span>
            <strong>Not connected</strong>
            <small>No sync</small>
          </div>
        </article>
        <article className="card device-stat">
          <span className="m-icon purple"><Icon name="shield" /></span>
          <div>
            <span>Sensor health</span>
            <strong>—</strong>
            <small>Not reported</small>
          </div>
        </article>
        <article className="card device-stat">
          <span className="m-icon orange"><Icon name="clock" /></span>
          <div>
            <span>System uptime</span>
            <strong>—</strong>
            <small>Not reported</small>
          </div>
        </article>
      </div>
      <div className="split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2>Device information</h2>
              <p>Hardware and network details</p>
            </div>
          </div>
          <dl className="details">
            {DEVICE_FIELDS.map((label) => (
              <div key={label}><dt>{label}</dt><dd>—</dd></div>
            ))}
          </dl>
        </section>
        <section className="card">
          <div className="section-head">
            <div>
              <h2>Communication activity</h2>
              <p>Most recent device events</p>
            </div>
          </div>
          <p className="empty-copy">No device events yet.</p>
        </section>
      </div>
    </>
  );
}

const SETTINGS_NAV = [
  { id: "thresholds", label: "Thresholds", icon: "thermo" },
  { id: "data", label: "Data collection", icon: "clock" },
  { id: "notes", label: "Notifications", icon: "bell" },
  { id: "firebase", label: "Firebase", icon: "database" },
  { id: "profile", label: "Profile", icon: "user" },
];

export function SettingsPage() {
  const { settings, setSettings, saveSettings, resetSettings, user } = useApp();
  const [tab, setTab] = useState("thresholds");
  const patch = (key, value) => setSettings({ ...settings, [key]: value });

  return (
    <>
      <Header kicker="System preferences" title="Settings" text="Configure thresholds, reading intervals, and notifications." />
      <div className="settings">
        <nav className="card settings-nav">
          {SETTINGS_NAV.map((item) => (
            <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
              <Icon name={item.icon} size={16} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="settings-body">
          {tab === "thresholds" && (
            <section className="card">
              <div className="section-head">
                <div>
                  <h2>Environmental thresholds</h2>
                  <p>Define the acceptable range for sensor readings</p>
                </div>
              </div>
              <div className="form-grid">
                <NumberField label="Normal temperature cutoff" unit="°C" help="ESP32 normal temperature rule: temperature must be below this value." value={settings.minTemp} onChange={(v) => patch("minTemp", v)} />
                <NumberField label="Alert temperature cutoff" unit="°C" help="ESP32 alert temperature rule: temperature must be below this value for warning status." value={settings.maxTemp} onChange={(v) => patch("maxTemp", v)} />
                <NumberField label="Normal humidity cutoff" unit="%" help="ESP32 normal humidity rule: humidity must be below this value." value={settings.maxHumidity} onChange={(v) => patch("maxHumidity", v)} />
              </div>
              <div className="zones">
                <span><i className="zone ok" /><b>&lt; {settings.minTemp}°C / &lt; {settings.maxHumidity}%</b> Normal</span>
                <span><i className="zone low" /><b>&lt; {settings.maxTemp}°C / &lt; 80%</b> Warning</span>
                <span><i className="zone high" /><b>Otherwise</b> Alert</span>
              </div>
            </section>
          )}
          {tab === "data" && (
            <section className="card">
              <div className="section-head">
                <div>
                  <h2>Data collection</h2>
                  <p>Control how often readings are captured and synchronized</p>
                </div>
              </div>
              <label className="stack">
                <span>Sensor reading interval</span>
                <select value={settings.interval} onChange={(e) => patch("interval", e.target.value)}>
                  <option value="">Select an interval</option>
                  <option value="1">Every minute</option>
                  <option value="5">Every 5 minutes</option>
                  <option value="10">Every 10 minutes</option>
                  <option value="30">Every 30 minutes</option>
                  <option value="60">Every hour</option>
                </select>
                <small>Controls dashboard history snapshots saved to Firebase. The ESP32 live record remains at /dht_station.</small>
              </label>
            </section>
          )}
          {tab === "notes" && (
            <section className="card">
              <div className="section-head">
                <div>
                  <h2>Notification preferences</h2>
                  <p>Choose how and when you want to be notified</p>
                </div>
              </div>
              <div className="toggles">
                <Toggle title="Push notifications" text="Receive alerts in this dashboard" checked={settings.push} onChange={(v) => patch("push", v)} />
                <Toggle title="Email notifications" text={`Send alert summaries to ${user.email}`} checked={settings.email} onChange={(v) => patch("email", v)} />
                <Toggle title="Alert notifications only" text="Immediately notify when limits are exceeded" checked={settings.criticalOnly} onChange={(v) => patch("criticalOnly", v)} />
              </div>
            </section>
          )}
          {tab === "firebase" && (
            <section className="card">
              <div className="section-head">
                <div>
                  <h2>Firebase connection</h2>
                  <p>Placeholder for Realtime Database. Values stay on this device.</p>
                </div>
              </div>
              <label className="stack">
                <span>Project ID</span>
                <input value={settings.projectId} onChange={(e) => patch("projectId", e.target.value)} />
              </label>
              <label className="stack">
                <span>Database URL</span>
                <input value={settings.databaseUrl} onChange={(e) => patch("databaseUrl", e.target.value)} />
                <small>Wire this URL when you connect the ESP32 publisher. The dashboard already expects temperature and humidity fields.</small>
              </label>
            </section>
          )}
          {tab === "profile" && (
            <section className="card">
              <div className="section-head">
                <div>
                  <h2>Profile</h2>
                  <p>The operator shown across the workspace</p>
                </div>
              </div>
              <div className="profile-card">
                <span className="avatar lg">{user.initials}</span>
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.role}</span>
                  <span>{user.email}</span>
                </div>
              </div>
            </section>
          )}
          <div className="settings-actions">
            <button className="btn ghost" onClick={resetSettings}>
              <Icon name="refresh" size={15} /> Reset
            </button>
            <button className="btn primary" onClick={saveSettings}>
              <Icon name="check" size={15} /> Save changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function NumberField({ label, unit, help, value, onChange }) {
  return (
    <label className="stack">
      <span>{label}</span>
      <div className="unit">
        <input type="number" value={value} placeholder="—" onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
        <em>{unit}</em>
      </div>
      <small>{help}</small>
    </label>
  );
}

function Toggle({ title, text, checked, onChange }) {
  return (
    <label className="toggle">
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  );
}
