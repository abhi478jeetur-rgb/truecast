import type { Units } from "@/types/weather";

/**
 * Open-Meteo returns city-local timestamps with no offset ("2026-11-14T08:30")
 * and calendar dates ("2026-11-14"). Parsing either with `new Date(value)` makes
 * the browser reinterpret them in the host timezone, which shifts the calendar
 * day for every user east or west of the city. Everything below reads the parts
 * and builds a local date from the parts, so the number on screen is the city's.
 */
export function parseLocal(value: string) {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return { year, month, day, hour, minute, datePart, timePart };
}

/** Local midnight for a city calendar date. Only used for weekday/month names. */
export function calendarDate(value: string): Date {
  const { year, month, day } = parseLocal(value);
  return new Date(year, month - 1, day);
}

const LOCALE = "en-US";

export function weekdayShort(value: string): string {
  return calendarDate(value).toLocaleDateString(LOCALE, { weekday: "short" });
}

export function longDate(value: string): string {
  return calendarDate(value).toLocaleDateString(LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function timeZoneName(timezone: string): string {
  const last = timezone.split("/").pop() ?? timezone;
  return last.replace(/_/g, " ");
}

/** "14:00" → "2pm", "00:00" → "12am". Never uses the host clock. */
export function hourLabel(value: string): string {
  const { hour } = parseLocal(value);
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  return `${hour % 12}${hour < 12 ? "am" : "pm"}`;
}

/** "16:58" → "4:58 PM". Leading zero dropped, as Apple does. */
export function clockLabel(value: string): string {
  const { hour, minute } = parseLocal(value);
  const suffix = hour < 12 ? "AM" : "PM";
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatTemp(value: number): string {
  return `${Math.round(value)}°`;
}

export function formatDecimal(value: number, places = 1): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(places);
}

export function formatWind(speed: number, units: Units): string {
  return `${Math.round(speed)} ${units.windSpeedLabel}`;
}

/**
 * Visibility arrives in metres. Metric readers think in kilometres, imperial
 * in miles — matching whichever system the wind unit already selected.
 */
export function formatVisibility(metres: number, units: Units): string {
  if (units.windSpeed === "mph") {
    const miles = metres / 1609.344;
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
  }
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

export function compassDirection(degrees: number): string {
  return COMPASS[Math.round(degrees / 22.5) % 16];
}

export function uvDescriptor(value: number): string {
  if (value < 3) return "Low";
  if (value < 6) return "Moderate";
  if (value < 8) return "High";
  if (value < 11) return "Very high";
  return "Extreme";
}

export function relativeUpdated(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return "Updated just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours} hr ago`;
}
