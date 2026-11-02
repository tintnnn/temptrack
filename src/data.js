export const DEFAULT_SETTINGS = {
  minTemp: "",
  maxTemp: "",
  maxHumidity: "",
  interval: "",
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
  const min = numberOrNull(settings.minTemp);
  const max = numberOrNull(settings.maxTemp);
  const humMax = numberOrNull(settings.maxHumidity);
  if (min == null || max == null) return "Unclassified";
  if (temp > max || (humMax != null && humidity > humMax + 5)) return "High";
  if (temp < min) return "Low";
  if (humMax != null && humidity > humMax) return "Warning";
  return "Normal";
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
