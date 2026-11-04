export const DEFAULT_SETTINGS = {
  minTemp: "30",
  maxTemp: "35",
  maxHumidity: "70",
  interval: "5",
  push: false,
  email: false,
  criticalOnly: false,
  projectId: "",
  databaseUrl: "",
};

export function userFromEmail(email) {
  const local = email.split("@")[0] || email;
  const name = local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return { name, email, role: "Signed in", initials: initials || "•" };
}

export function classify(temp, humidity, settings) {
  const normalMax = numberOrNull(settings.minTemp) ?? 30;
  const alertTemp = numberOrNull(settings.maxTemp) ?? 35;
  const normalHumidity = numberOrNull(settings.maxHumidity) ?? 70;
  if (temp < normalMax && humidity < normalHumidity) return "Normal";
  if (temp < alertTemp && humidity < 80) return "Warning";
  return "Alert";
}

export function normalizeStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "NORMAL") return "Normal";
  if (normalized === "WARNING") return "Warning";
  if (normalized === "ALERT") return "Alert";
  return null;
}

export function statusForReading(reading, readings, settings) {
  return normalizeStatus(reading.status) || classify(reading.temp, reading.hum, settings);
}

export function rollingAverage(readings, endTime) {
  const end = endTime instanceof Date ? endTime.getTime() : endTime;
  const window = readings.filter((reading) => {
    const time = reading.at.getTime();
    return time <= end && end - time <= 3 * 60 * 1000;
  });
  if (!window.length) return null;
  return window.reduce((sum, reading) => sum + reading.temp, 0) / window.length;
}

export function averagedStatus(reading, readings, settings) {
  const average = rollingAverage(readings, reading.at);
  if (average == null) return statusForReading(reading, readings, settings);
  return classify(average, reading.hum, settings);
}

export function isConfirmedAlert(reading, readings, settings) {
  if (statusForReading(reading, readings, settings) !== "Alert") return false;
  const start = reading.at.getTime() - 3 * 60 * 1000;
  const window = readings.filter((item) => {
    const time = item.at.getTime();
    return time >= start && time <= reading.at.getTime();
  });
  if (window.length < 2) return false;
  const oldest = window[window.length - 1];
  if (reading.at.getTime() - oldest.at.getTime() < 3 * 60 * 1000) return false;
  return window.every((item) => statusForReading(item, readings, settings) === "Alert");
}

function numberOrNull(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatWhen(date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
