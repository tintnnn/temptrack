import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_SETTINGS, formatWhen, isConfirmedAlert, statusForReading, userFromEmail } from "./data.js";
import {
  auth,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  set,
  historyRef,
  historyRootRef,
  stationRef,
} from "./firebase.js";
import { Icon } from "./icons.jsx";
import { Login } from "./Login.jsx";
import { Shell } from "./Shell.jsx";
import { AlertsPage, AnalyticsPage, DashboardPage, DevicesPage, HistoryPage, LivePage, SettingsPage } from "./pages.jsx";
import { AppContext } from "./store.js";
import { onAuthStateChanged } from "firebase/auth";
import { onValue } from "firebase/database";

const PAGES = {
  dashboard: DashboardPage,
  live: LivePage,
  analytics: AnalyticsPage,
  history: HistoryPage,
  alerts: AlertsPage,
  devices: DevicesPage,
  settings: SettingsPage,
};

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeReading(value, key, fallbackTime, useKeyTimestamp = false) {
  if (!value || typeof value !== "object") return null;
  const temp = numberValue(value.temperature ?? value.temp ?? value.temperatureC);
  const hum = numberValue(value.humidity ?? value.hum ?? value.humidityPercent);
  if (temp == null || hum == null) return null;
  const rawTime = value.timestamp ?? value.time ?? value.createdAt ?? (useKeyTimestamp ? key : null);
  const parsedTime = numberValue(rawTime) ?? Date.parse(rawTime);
  return {
    id: key || String(rawTime || fallbackTime),
    temp,
    hum,
    status: value.status,
    uptime: numberValue(value.uptime),
    at: new Date(Number.isFinite(parsedTime) && rawTime != null ? parsedTime : fallbackTime),
  };
}

function readingsFromSnapshot(snapshot, receivedAt = Date.now(), limit = 100, useKeyTimestamp = false) {
  const value = snapshot.val();
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value);
  const isReading = entries.some(([key]) => ["temperature", "temp", "humidity", "hum"].includes(key));
  const rows = isReading
    ? [normalizeReading(value, `dht_station-${value.uptime ?? receivedAt}`, receivedAt)]
    : entries.map(([key, reading]) => normalizeReading(reading, key, receivedAt, useKeyTimestamp));
  return rows
    .filter((reading) => reading && reading.temp >= 0 && reading.temp <= 50)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS);
  const [readings, setReadings] = useState([]);
  const [historyReadings, setHistoryReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [readAlerts, setReadAlerts] = useState(() => new Set());
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const notifiedReadings = useRef(new Set());
  const previousStatus = useRef(null);
  const lastHistoryWrite = useRef(0);
  const latestReadingRef = useRef(null);
  latestReadingRef.current = readings[0] || null;

  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser ? userFromEmail(firebaseUser.email || "") : null);
  }), []);

  useEffect(() => {
    if (!user) {
      setReadings([]);
      setHistoryReadings([]);
      setAlerts([]);
      setFirebaseConnected(false);
      notifiedReadings.current.clear();
      previousStatus.current = null;
      lastHistoryWrite.current = 0;
      return undefined;
    }
    return onValue(stationRef, (snapshot) => {
      setFirebaseConnected(true);
      const incoming = readingsFromSnapshot(snapshot);
      setReadings((previous) => {
        const known = new Set(previous.map((reading) => reading.id));
        const additions = incoming.filter((reading) => !known.has(reading.id));
        return [...additions, ...previous].sort((a, b) => b.at - a.at).slice(0, 100);
      });
    }, (error) => {
      setFirebaseConnected(false);
      setToast(`Unable to read sensor data: ${error.message}`);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    return onValue(historyRootRef, (snapshot) => {
      const history = readingsFromSnapshot(snapshot, Date.now(), 10000, true);
      setHistoryReadings(history);
    }, (error) => {
      setToast(`Unable to read Firebase history: ${error.message}`);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !readings.length) return;
    const latestReading = readings[0];
    const latestStatus = statusForReading(latestReading, readings, settings);
    const statusChanged = latestStatus !== previousStatus.current;
    previousStatus.current = latestStatus;
    const confirmedAlert = latestStatus === "Alert" && isConfirmedAlert(latestReading, readings, settings);
    const newAlertEpisode = confirmedAlert && !notifiedReadings.current.has("Alert");
    const abnormal = (statusChanged && latestStatus === "Warning") || newAlertEpisode
      ? [{ reading: latestReading, status: latestStatus }]
      : [];
    setAlerts((previous) => {
      const known = new Set(previous.map((alert) => alert.id));
      const additions = abnormal
        .filter(({ reading, status }) => !known.has(`reading-${reading.id}-${status}`))
        .map(({ reading, status }) => ({
          id: `reading-${reading.id}-${status}`,
          level: status === "Alert" ? "alert" : "warning",
          title: status === "Alert" ? "Environmental alert" : "Environmental warning",
          detail: `${reading.temp.toFixed(1)}°C and ${reading.hum}% humidity at ${formatWhen(reading.at)}`,
          time: formatWhen(reading.at),
          at: reading.at.getTime(),
        }));
      return [...additions, ...previous].slice(0, 100);
    });
    if (latestStatus !== "Alert") {
      notifiedReadings.current.delete("Alert");
    }
    if (newAlertEpisode) {
      notifiedReadings.current.add("Alert");
      setToast(`Alert: environmental limits exceeded (${latestReading.temp.toFixed(1)}°C, ${latestReading.hum}%)`);
    }
  }, [readings, settings, user]);

  useEffect(() => {
    if (!user) return undefined;
    const intervalMinutes = Math.max(1, Number(settings.interval) || 5);
    const writeHistory = async () => {
      const latestReading = latestReadingRef.current;
      if (!latestReading) return;
      const now = Date.now();
      if (now - lastHistoryWrite.current < intervalMinutes * 60 * 1000) return;
      try {
        await set(historyRef(now), {
          temperature: latestReading.temp,
          humidity: latestReading.hum,
          status: latestReading.status || statusForReading(latestReading, readings, settings).toUpperCase(),
          recordedAt: new Date(now).toISOString(),
          source: "dashboard",
        });
        lastHistoryWrite.current = now;
      } catch (error) {
        setToast(`Unable to save history: ${error.message}`);
      }
    };
    writeHistory();
    const timer = setInterval(writeHistory, 30 * 1000);
    return () => clearInterval(timer);
  }, [settings.interval, user]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const unread = alerts.filter((alert) => !readAlerts.has(alert.id)).length;
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
      historyReadings,
      setReadings,
      alerts,
      setAlerts,
      latest,
      firebaseConnected,
      unread,
      readAlerts,
      markAllRead: () => {
        setReadAlerts(new Set(alerts.map((alert) => alert.id)));
        setToast(alerts.length ? "All alerts marked as read" : "No alerts to update");
      },
      markRead: (id) => setReadAlerts((prev) => new Set(prev).add(id)),
      signOut: () => {
        firebaseSignOut(auth).catch((error) => setToast(`Unable to sign out: ${error.message}`));
        setPage("dashboard");
      },
      signIn: async (remember, email, password) => {
        await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email, password);
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(auth, email);
      },
      user,
    }),
    [page, sidebarOpen, settings, savedSettings, readings, historyReadings, alerts, latest, firebaseConnected, unread, readAlerts, user]
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
