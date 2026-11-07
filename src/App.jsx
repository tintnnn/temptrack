import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_SETTINGS, formatWhen, statusForReading, threeMinuteAverageStatus, userFromEmail } from "./data.js";
import {
  auth,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  alertDocument,
  alertsCollection,
  readingDocument,
  readingsCollection,
  stationRef,
} from "./firebase.js";
import { Icon } from "./icons.jsx";
import { Login } from "./Login.jsx";
import { Shell } from "./Shell.jsx";
import { AlertsPage, AnalyticsPage, DashboardPage, DevicesPage, HistoryPage, LivePage, SettingsPage } from "./pages.jsx";
import { AppContext } from "./store.js";
import { onAuthStateChanged } from "firebase/auth";
import { onValue } from "firebase/database";
import { limit, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";

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
  const rawTime = value.timestamp ?? value.time ?? value.createdAt ?? value.recordedAt ?? (useKeyTimestamp ? key : null);
  const timestampValue = rawTime?.toDate ? rawTime.toDate().getTime() : rawTime;
  const parsedTime = numberValue(timestampValue) ?? Date.parse(timestampValue);
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
  const [alertPopup, setAlertPopup] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS);
  const [readings, setReadings] = useState([]);
  const [historyReadings, setHistoryReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [readAlerts, setReadAlerts] = useState(() => new Set());
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const previousStatus = useRef(null);
  const archivedReading = useRef(null);

  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser ? userFromEmail(firebaseUser.email || "") : null);
  }), []);

  useEffect(() => {
    if (!user) {
      setReadings([]);
      setHistoryReadings([]);
      setAlerts([]);
      setFirebaseConnected(false);
      previousStatus.current = null;
      archivedReading.current = null;
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
      const latest = incoming[0];
      if (latest) {
        const intervalMinutes = Math.max(1, Number(settings.interval) || 5);
        const intervalMs = intervalMinutes * 60 * 1000;
        const archiveBucket = Math.floor(latest.at.getTime() / intervalMs) * intervalMs;
        const archiveId = `live_${archiveBucket}`;
        if (archiveId !== archivedReading.current) {
          archivedReading.current = archiveId;
          setDoc(readingDocument(archiveId), {
            temperature: latest.temp,
            humidity: latest.hum,
            status: latest.status || null,
            uptime: latest.uptime,
            recordedAt: new Date(archiveBucket),
            source: "rtdb:dht_station:client",
            rtdbPath: "dht_station",
          }, { merge: true }).catch((error) => {
            setToast(`Unable to archive reading in Firestore: ${error.message}`);
          });
        }
      }
    }, (error) => {
      setFirebaseConnected(false);
      setToast(`Unable to read sensor data: ${error.message}`);
    });
  }, [settings.interval, user]);

  useEffect(() => {
    if (!user) return undefined;
    const historyQuery = query(readingsCollection, orderBy("recordedAt", "desc"), limit(10000));
    return onSnapshot(historyQuery, (snapshot) => {
      const history = snapshot.docs
        .map((document) => normalizeReading(document.data(), document.id, Date.now()))
        .filter((reading) => reading && reading.temp >= 0 && reading.temp <= 50)
        .sort((a, b) => b.at - a.at);
      setHistoryReadings(history);
    }, (error) => {
      setToast(`Unable to read Firestore history: ${error.message}`);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const alertsQuery = query(alertsCollection, orderBy("occurredAt", "desc"), limit(1000));
    return onSnapshot(alertsQuery, (snapshot) => {
      setAlerts(snapshot.docs.map((document) => {
        const value = document.data();
        return {
          id: document.id,
          level: value.level === "warm" ? "warning" : value.level,
          title: value.title,
          detail: value.detail,
          time: formatWhen(value.occurredAt?.toDate?.() || new Date()),
          at: value.occurredAt?.toDate?.()?.getTime() || Date.now(),
          status: value.status,
        };
      }));
    }, (error) => {
      setToast(`Unable to load alert logs: ${error.message}`);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !readings.length) return;
    const average = threeMinuteAverageStatus(readings, settings);
    if (!average) return;
    const hasPreviousStatus = previousStatus.current != null;
    const statusChanged = hasPreviousStatus && average.status !== previousStatus.current;
    previousStatus.current = average.status;
    const abnormal = statusChanged
      ? [{ reading: average, status: average.status }]
      : [];
    setAlerts((previous) => {
      const known = new Set(previous.map((alert) => alert.id));
      const additions = abnormal
        .filter(({ reading, status }) => !known.has(`reading-${reading.id}-${status}`))
        .map(({ reading, status }) => ({
          id: `reading-${reading.id}-${status}`,
          level: status.toLowerCase(),
          title: `Environmental status: ${status}`,
          detail: `3-minute average: ${reading.temperature.toFixed(1)}°C and ${reading.humidity.toFixed(1)}% humidity at ${formatWhen(reading.at)}`,
          time: formatWhen(reading.at),
          at: reading.at.getTime(),
        }));
      return [...additions, ...previous].slice(0, 100);
    });
    if (statusChanged) {
      const alertId = `transition_${average.at.getTime()}_${average.status.toLowerCase()}`;
      const alert = {
        id: alertId,
        level: average.status.toLowerCase(),
        title: `Environmental status: ${average.status}`,
        detail: `3-minute average: ${average.temperature.toFixed(1)}°C and ${average.humidity.toFixed(1)}% humidity at ${formatWhen(average.at)}`,
        time: formatWhen(average.at),
        at: average.at.getTime(),
        status: average.status,
      };
      setDoc(alertDocument(alertId), {
        level: alert.level,
        title: alert.title,
        detail: alert.detail,
        status: alert.status,
        occurredAt: average.at,
        source: "dashboard:three-minute-average",
      }, { merge: true }).catch((error) => {
        setToast(`Unable to save alert log: ${error.message}`);
      });
      setAlertPopup({
        status: average.status,
        temperature: average.temperature,
        humidity: average.humidity,
      });
      setToast(`3-minute average changed to ${average.status}`);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`TEMPTRACK ${average.status.toLowerCase()} status`, {
          body: `3-minute average: ${average.temperature.toFixed(1)}°C and ${average.humidity.toFixed(1)}% humidity.`,
        });
      } else if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification("TEMPTRACK environmental alert", {
              body: `The 3-minute average changed to ${average.status}.`,
            });
          }
        });
      }
    }
  }, [readings, settings, user]);

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
      {alertPopup && (
        <div className="alert-modal-backdrop" role="presentation">
          <section className={`alert-modal ${alertPopup.status.toLowerCase()}`} role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
            <button
              className="alert-modal-close"
              type="button"
              aria-label="Close alert reminder"
              onClick={() => setAlertPopup(null)}
            >
              ×
            </button>
            <div className="alert-modal-icon">
              <Icon name="thermo" size={28} />
            </div>
            <div>
              <p className="eyebrow">{alertPopup.status} status transition</p>
              <h2 id="alert-title">
                {alertPopup.status === "Alert"
                  ? "Reminder: open the air conditioner"
                      : alertPopup.status === "Warning"
                    ? "Reminder: monitor the environment"
                    : "Conditions returned to normal"}
              </h2>
              <p>
                The strict 3-minute average changed to {alertPopup.status}.
                Average: {alertPopup.temperature.toFixed(1)}°C and {alertPopup.humidity.toFixed(1)}% humidity.
              </p>
            </div>
          </section>
        </div>
      )}
    </AppContext.Provider>
  );
}
