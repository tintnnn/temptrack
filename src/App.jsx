import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, userFromEmail } from "./data.js";
import { Icon } from "./icons.jsx";
import { Login } from "./Login.jsx";
import { Shell } from "./Shell.jsx";
import { AlertsPage, AnalyticsPage, DashboardPage, DevicesPage, HistoryPage, LivePage, SettingsPage } from "./pages.jsx";
import { AppContext } from "./store.js";

const PAGES = {
  dashboard: DashboardPage,
  live: LivePage,
  analytics: AnalyticsPage,
  history: HistoryPage,
  alerts: AlertsPage,
  devices: DevicesPage,
  settings: SettingsPage,
};

function storedUser() {
  try {
    const raw = localStorage.getItem("temptrack-user");
    if (!raw) return null;
    const email = JSON.parse(raw);
    return typeof email === "string" && email.includes("@") ? userFromEmail(email) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(storedUser);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS);
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [readAlerts, setReadAlerts] = useState(() => new Set());

  useEffect(() => {
    localStorage.removeItem("temptrack-session");
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const unread = alerts.filter((alert) => alert.level !== "resolved" && !readAlerts.has(alert.id)).length;
  const latest = readings[0] ?? null;

  const api = useMemo(
    () => ({
      page,
      setPage: (next) => {
        setPage(next);
        setSidebarOpen(false);
      },
      sidebarOpen,
      setSidebarOpen,
      settings,
      setSettings,
      savedSettings,
      saveSettings: () => {
        setSavedSettings(settings);
        setToast("Settings saved on this device");
      },
      resetSettings: () => {
        setSettings(savedSettings);
        setToast("Changes reverted");
      },
      toast: setToast,
      readings,
      setReadings,
      alerts,
      setAlerts,
      latest,
      unread,
      readAlerts,
      markAllRead: () => {
        setReadAlerts(new Set(alerts.map((alert) => alert.id)));
        setToast(alerts.length ? "All alerts marked as read" : "No alerts to update");
      },
      markRead: (id) => setReadAlerts((prev) => new Set(prev).add(id)),
      signOut: () => {
        localStorage.removeItem("temptrack-user");
        setUser(null);
        setPage("dashboard");
      },
      signIn: (remember, email) => {
        if (remember) localStorage.setItem("temptrack-user", JSON.stringify(email));
        setUser(userFromEmail(email));
      },
      user,
    }),
    [page, sidebarOpen, settings, savedSettings, readings, alerts, latest, unread, readAlerts, user]
  );

  return (
    <AppContext.Provider value={api}>
      {user ? (
        <Shell>
          {(() => {
            const Page = PAGES[page];
            return <Page />;
          })()}
        </Shell>
      ) : (
        <Login />
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={16} />
          {toast}
        </div>
      )}
    </AppContext.Provider>
  );
}
