import type { WeatherCode } from "@/types/weather";

export interface AppTheme {
  /** CSS `linear-gradient` painted behind the whole window. */
  gradient: string;
  /**
   * True when the backdrop is dark enough that body copy must be light.
   * This is a property of the *rendered* colours, not of the clock: an
   * overcast day is light even though it is grey, and rain at noon is dark.
   */
  dark: boolean;
}

const NIGHT_CLEAR: AppTheme = {
  gradient: "linear-gradient(180deg, #0b1220 0%, #1e293b 100%)",
  dark: true,
};

const NIGHT_CLOUD: AppTheme = {
  gradient: "linear-gradient(180deg, #101a2c 0%, #334155 100%)",
  dark: true,
};

const NIGHT_DEEP: AppTheme = {
  gradient: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
  dark: true,
};

const DAY: Record<WeatherCode, AppTheme> = {
  clear: {
    gradient: "linear-gradient(180deg, #bfdbfe 0%, #60a5fa 100%)",
    dark: false,
  },
  "partly-cloudy": {
    gradient: "linear-gradient(180deg, #bae6fd 0%, #93c5fd 100%)",
    dark: false,
  },
  overcast: {
    gradient: "linear-gradient(180deg, #475569 0%, #1e293b 100%)",
    dark: true,
  },
  fog: {
    gradient: "linear-gradient(180deg, #f3f4f6 0%, #d1d5db 100%)",
    dark: false,
  },
  drizzle: {
    gradient: "linear-gradient(180deg, #4b5563 0%, #1f2937 100%)",
    dark: true,
  },
  rain: {
    gradient: "linear-gradient(180deg, #475569 0%, #1f2937 100%)",
    dark: true,
  },
  "rain-showers": {
    gradient: "linear-gradient(180deg, #475569 0%, #1e293b 100%)",
    dark: true,
  },
  snow: {
    gradient: "linear-gradient(180deg, #f3f4f6 0%, #cbd5e1 100%)",
    dark: false,
  },
  "snow-showers": {
    gradient: "linear-gradient(180deg, #eef2f7 0%, #cbd5e1 100%)",
    dark: false,
  },
  thunderstorm: {
    gradient: "linear-gradient(180deg, #374151 0%, #111827 100%)",
    dark: true,
  },
  "thunderstorm-rain": {
    gradient: "linear-gradient(180deg, #334155 0%, #0b1220 100%)",
    dark: true,
  },
};

const NIGHT: Record<WeatherCode, AppTheme> = {
  clear: NIGHT_CLEAR,
  "partly-cloudy": NIGHT_CLOUD,
  overcast: NIGHT_CLEAR,
  fog: NIGHT_DEEP,
  drizzle: NIGHT_DEEP,
  rain: NIGHT_DEEP,
  "rain-showers": NIGHT_DEEP,
  snow: NIGHT_CLEAR,
  "snow-showers": NIGHT_CLEAR,
  thunderstorm: NIGHT_DEEP,
  "thunderstorm-rain": NIGHT_DEEP,
};

export function themeFor(code: WeatherCode, isNight: boolean): AppTheme {
  return isNight ? NIGHT[code] ?? NIGHT_CLEAR : DAY[code] ?? DAY.clear;
}
