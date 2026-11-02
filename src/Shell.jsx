import { useEffect, useState } from "react";
import { useApp } from "./store.js";
import { Icon } from "./icons.jsx";
import { Brand } from "./Login.jsx";

const NAV = [
  {
    label: "Monitoring",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "grid" },
      { id: "live", label: "Live Monitoring", icon: "activity" },
      { id: "analytics", label: "Analytics", icon: "chart" },
      { id: "history", label: "Historical Data", icon: "clock" },
    ],
  },
  {
    label: "Management",
    items: [
      { id: "alerts", label: "Alerts & Notifications", icon: "bell" },
      { id: "devices", label: "Device Management", icon: "chip" },
      { id: "settings", label: "Settings", icon: "gear" },
    ],
  },
];

const TITLES = {
  dashboard: "Dashboard",
  live: "Live Monitoring",
  analytics: "Analytics",
  history: "Historical Data",
  alerts: "Alerts & Notifications",
  devices: "Device Management",
  settings: "Settings",
};

export function Shell({ children }) {
  const { page, setPage, sidebarOpen, setSidebarOpen, unread, latest, alerts, signOut, user } = useApp();
  const [now, setNow] = useState(new Date());
  const [notesOpen, setNotesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

  return (
    <div className={`app-shell ${sidebarOpen ? "nav-open" : ""}`}>
      <div className="scrim" onClick={() => setSidebarOpen(false)} />
      <aside className="sidebar">
        <div className="sidebar-head">
          <Brand light />
          <button className="icon-btn on-dark" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>
            <Icon name="close" />
          </button>
        </div>
        {NAV.map((group) => (
          <div key={group.label} className="nav-group">
            <p>{group.label}</p>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={page === item.id ? "active" : ""}
                onClick={() => setPage(item.id)}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {item.id === "alerts" && unread > 0 && <b className="count">{unread}</b>}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <div className="side-device">
            <Icon name="chip" size={16} />
            <div>
              <strong>{latest ? "Station" : "No station"}</strong>
              <span>{latest ? `${latest.temp.toFixed(1)}°` : "No reading"}</span>
            </div>
          </div>
          <button className="side-user" onClick={() => setPage("settings")}>
            <span className="avatar">{user.initials}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </div>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button className="icon-btn menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="topbar-title">
            <span>Workspace</span>
            <strong>{TITLES[page]}</strong>
          </div>
          <div className="topbar-right">
            <div className="clock">
              <Icon name="calendar" size={16} />
              <div>
                <strong>{date}</strong>
                <span>{time}</span>
              </div>
            </div>
            <div className="pop">
              <button
                className="icon-btn"
                aria-label="Notifications"
                onClick={() => {
                  setNotesOpen((v) => !v);
                  setProfileOpen(false);
                }}
              >
                <Icon name="bell" />
                {unread > 0 && <i />}
              </button>
              {notesOpen && (
                <div className="popover">
                  <header>
                    <strong>Notifications</strong>
                    <span>{unread} unread</span>
                  </header>
                  {alerts.length === 0 && <p className="empty-copy">No notifications yet.</p>}
                  {alerts.slice(0, 4).map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => {
                        setNotesOpen(false);
                        setPage("alerts");
                      }}
                    >
                      <b className={`lvl ${alert.level}`} />
                      <span>
                        <strong>{alert.title}</strong>
                        <small>{alert.time}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="pop">
              <button
                className="profile-btn"
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setNotesOpen(false);
                }}
              >
                <span className="avatar sm">{user.initials}</span>
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.role}</span>
                </div>
                <Icon name="chevronDown" size={14} />
              </button>
              {profileOpen && (
                <div className="popover slim">
                  <p>
                    {user.email}
                    <small>Signed in on this browser</small>
                  </p>
                  <button onClick={() => { setProfileOpen(false); setPage("settings"); }}>
                    <Icon name="gear" size={16} /> Settings
                  </button>
                  <button onClick={signOut}>
                    <Icon name="logout" size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content" onClick={() => { setNotesOpen(false); setProfileOpen(false); }}>
          {children}
          <footer>
            <span>TEMPTRACK IoT</span>
            <span>No sensor feed connected</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
