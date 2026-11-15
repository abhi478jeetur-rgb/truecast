import axios, { isAxiosError, type AxiosInstance } from "axios";
import type {
  City,
  CurrentWeather,
  DailyForecast,
  HourlyForecast,
  TemperatureUnit,
  Units,
  WeatherCode,
  WeatherCondition,
  WeatherData,
  WeatherDetails,
  WindSpeedUnit,
} from "@/types/weather";
import { weekdayShort } from "@/lib/format";

const GEOCODING_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";

/** Cached responses younger than this are reused instead of re-fetched. */
const CACHE_TTL_MS = 60_000;

/** The user's unit preference. Display labels come back from the API. */
export interface UnitPreferences {
  temperature: TemperatureUnit;
  windSpeed: WindSpeedUnit;
}

export const DEFAULT_UNITS: UnitPreferences = {
  temperature: "celsius",
  windSpeed: "kmh",
};

export const HOURLY_WINDOW = 24;

const WMO_CODE_MAP: Record<number, { code: WeatherCode; description: string; icon: string }> = {
  0: { code: "clear", description: "Clear", icon: "sun" },
  1: { code: "partly-cloudy", description: "Mainly clear", icon: "sun-cloud" },
  2: { code: "partly-cloudy", description: "Partly cloudy", icon: "sun-cloud" },
  3: { code: "overcast", description: "Overcast", icon: "cloud" },
  45: { code: "fog", description: "Fog", icon: "cloud-fog" },
  48: { code: "fog", description: "Depositing rime fog", icon: "cloud-fog" },
  51: { code: "drizzle", description: "Light drizzle", icon: "cloud-drizzle" },
  53: { code: "drizzle", description: "Moderate drizzle", icon: "cloud-drizzle" },
  55: { code: "drizzle", description: "Dense drizzle", icon: "cloud-drizzle" },
  56: { code: "drizzle", description: "Light freezing drizzle", icon: "cloud-drizzle" },
  57: { code: "drizzle", description: "Dense freezing drizzle", icon: "cloud-drizzle" },
  61: { code: "rain", description: "Slight rain", icon: "cloud-rain" },
  63: { code: "rain", description: "Moderate rain", icon: "cloud-rain" },
  65: { code: "rain", description: "Heavy rain", icon: "cloud-rain" },
  66: { code: "rain", description: "Light freezing rain", icon: "cloud-rain" },
  67: { code: "rain", description: "Heavy freezing rain", icon: "cloud-rain" },
  71: { code: "snow", description: "Slight snow", icon: "cloud-snow" },
  73: { code: "snow", description: "Moderate snow", icon: "cloud-snow" },
  75: { code: "snow", description: "Heavy snow", icon: "cloud-snow" },
  77: { code: "snow", description: "Snow grains", icon: "cloud-snow" },
  80: { code: "rain-showers", description: "Slight rain showers", icon: "cloud-rain" },
  81: { code: "rain-showers", description: "Moderate rain showers", icon: "cloud-rain" },
  82: { code: "rain-showers", description: "Violent rain showers", icon: "cloud-rain" },
  85: { code: "snow-showers", description: "Slight snow showers", icon: "cloud-snow" },
  86: { code: "snow-showers", description: "Heavy snow showers", icon: "cloud-snow" },
  95: { code: "thunderstorm", description: "Thunderstorm", icon: "cloud-lightning" },
  96: { code: "thunderstorm-rain", description: "Thunderstorm with hail", icon: "cloud-lightning" },
  99: { code: "thunderstorm-rain", description: "Thunderstorm with heavy hail", icon: "cloud-lightning" },
};

function mapWeatherCode(code: number, isNight: boolean): WeatherCondition {
  const mapped = WMO_CODE_MAP[code] ?? WMO_CODE_MAP[0];
  return { ...mapped, isNight };
}

interface SunTimes {
  sunrise: string;
  sunset: string;
}

/**
 * Day or night is decided by the city's own sunrise and sunset for that date —
 * not by the host clock, and not by a fixed 6am/8pm guess. Both sides are naive
 * city-local ISO strings ("2026-11-14T06:49"), so a lexical comparison is exact.
 */
export function isNightAt(localIso: string, sunByDate: Map<string, SunTimes>): boolean {
  const sun = sunByDate.get(localIso.slice(0, 10));
  if (!sun) return false;
  return localIso < sun.sunrise || localIso >= sun.sunset;
}

export function messageForError(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return "The weather service took too long to respond.";
    }
    if (!error.response) {
      return "Can't reach the weather service. Check your connection.";
    }
    return `The weather service returned an error (${error.response.status}).`;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong loading the weather.";
}

interface ForecastResponse {
  timezone: string;
  utc_offset_seconds: number;
  current_units: Record<string, string>;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    uv_index: number;
    visibility: number;
    pressure_msl: number;
    precipitation: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    precipitation_probability_max: number[];
  };
}

export class WeatherApiService {
  private client: AxiosInstance;
  private cache = new Map<string, { at: number; data: WeatherData }>();
  private inflight = new Map<string, Promise<WeatherData>>();

  constructor() {
    this.client = axios.create({
      timeout: 15000,
      headers: { Accept: "application/json" },
    });
  }

  async searchCities(query: string, signal?: AbortSignal): Promise<City[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const { data } = await this.client.get<{
      results?: Array<{
        id: number;
        name: string;
        country: string;
        admin1?: string;
        latitude: number;
        longitude: number;
      }>;
    }>(GEOCODING_BASE, {
      params: { name: trimmed, count: 6, language: "en", format: "json" },
      signal,
    });
    const results = data.results ?? [];
    return results.map((r) => ({
      id: String(r.id),
      name: r.name,
      country: r.country,
      admin1: r.admin1,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
  }

  /**
   * One forecast, deduplicated. Three components used to mount three hooks and
   * fire three identical requests; now any concurrent caller shares one promise
   * and repeat callers within a minute share one response.
   */
  async fetchWeather(
    latitude: number,
    longitude: number,
    prefs: UnitPreferences = DEFAULT_UNITS,
    options: { force?: boolean } = {},
  ): Promise<WeatherData> {
    const key = `${latitude.toFixed(4)},${longitude.toFixed(4)},${prefs.temperature},${prefs.windSpeed}`;

    if (!options.force) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
      const pending = this.inflight.get(key);
      if (pending) return pending;
    }

    const request = this.request(latitude, longitude, prefs)
      .then((data) => {
        this.cache.set(key, { at: Date.now(), data });
        return data;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, request);
    return request;
  }

  private async request(
    latitude: number,
    longitude: number,
    prefs: UnitPreferences,
  ): Promise<WeatherData> {
    const { data } = await this.client.get<ForecastResponse>(FORECAST_BASE, {
      params: {
        latitude,
        longitude,
        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "weather_code",
          "wind_speed_10m",
          "wind_direction_10m",
          "uv_index",
          "visibility",
          "pressure_msl",
          "precipitation",
        ].join(","),
        hourly: "temperature_2m,weather_code,precipitation_probability",
        daily: [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
          "sunrise",
          "sunset",
          "precipitation_probability_max",
        ].join(","),
        timezone: "auto",
        // Seven days is the API default; the UI promises ten.
        forecast_days: 10,
        // Start the hourly array at the city's current hour rather than midnight.
        forecast_hours: HOURLY_WINDOW + 6,
        temperature_unit: prefs.temperature,
        wind_speed_unit: prefs.windSpeed,
        precipitation_unit: "mm",
      },
    });

    const sunByDate = new Map<string, SunTimes>();
    data.daily.time.forEach((date, i) => {
      sunByDate.set(date, {
        sunrise: data.daily.sunrise[i],
        sunset: data.daily.sunset[i],
      });
    });

    const units: Units = {
      temperature: prefs.temperature,
      windSpeed: prefs.windSpeed,
      temperatureLabel:
        data.current_units.temperature_2m ?? (prefs.temperature === "celsius" ? "°C" : "°F"),
      // Open-Meteo labels miles per hour "mp/h", which is not a unit symbol
      // anyone reads. The value is theirs; the symbol is the conventional one
      // for the unit we asked for.
      windSpeedLabel: prefs.windSpeed === "mph" ? "mph" : "km/h",
      precipitationLabel: data.current_units.precipitation ?? "mm",
    };

    const currentIsNight = isNightAt(data.current.time, sunByDate);

    const current: CurrentWeather = {
      localTime: data.current.time,
      temperature: data.current.temperature_2m,
      apparentTemperature: data.current.apparent_temperature,
      condition: mapWeatherCode(data.current.weather_code, currentIsNight),
      humidity: data.current.relative_humidity_2m,
      pressure: data.current.pressure_msl,
      windSpeed: data.current.wind_speed_10m,
      windDirection: data.current.wind_direction_10m,
      visibilityMetres: data.current.visibility,
      uvIndex: data.current.uv_index,
      sunrise: data.daily.sunrise[0] ?? "",
      sunset: data.daily.sunset[0] ?? "",
      precipitation: data.current.precipitation,
    };

    // The hourly array begins at the city's current hour, but `current.time`
    // carries minutes ("08:30"), so match on the hour prefix rather than the
    // whole string. Everything downstream is city-local, so it never drifts.
    const currentHour = data.current.time.slice(0, 13);
    const startIndex = Math.max(
      0,
      data.hourly.time.findIndex((t) => t.slice(0, 13) >= currentHour),
    );

    const hourly: HourlyForecast[] = data.hourly.time
      .slice(startIndex, startIndex + HOURLY_WINDOW)
      .map((time, offset) => {
        const i = startIndex + offset;
        return {
          time,
          temperature: data.hourly.temperature_2m[i],
          condition: mapWeatherCode(data.hourly.weather_code[i], isNightAt(time, sunByDate)),
          precipitationProbability: data.hourly.precipitation_probability[i] ?? 0,
          isCurrent: time.slice(0, 13) === currentHour,
        };
      });

    // The hero shows the current reading; the "Now" card must show the same
    // number, not the colder/warmer top of the hour bucket.
    const currentHourEntry = hourly.find((hour) => hour.isCurrent);
    if (currentHourEntry) {
      currentHourEntry.temperature = current.temperature;
      currentHourEntry.condition = current.condition;
    }

    const daily: DailyForecast[] = data.daily.time.map((date, i) => ({
      date,
      dayName: weekdayShort(date),
      maxTemperature: data.daily.temperature_2m_max[i],
      minTemperature: data.daily.temperature_2m_min[i],
      condition: mapWeatherCode(data.daily.weather_code[i], false),
      precipitationProbability: data.daily.precipitation_probability_max[i],
      sunrise: data.daily.sunrise[i],
      sunset: data.daily.sunset[i],
      isToday: i === 0,
    }));

    const details: WeatherDetails = {
      uvIndex: current.uvIndex,
      windSpeed: current.windSpeed,
      windDirection: current.windDirection,
      humidity: current.humidity,
      visibilityMetres: current.visibilityMetres,
      pressure: current.pressure,
      sunrise: current.sunrise,
      sunset: current.sunset,
    };

    return {
      city: {
        id: `${latitude}-${longitude}`,
        name: "",
        country: "",
        latitude,
        longitude,
      },
      timezone: data.timezone,
      utcOffsetSeconds: data.utc_offset_seconds,
      units,
      current,
      hourly,
      daily,
      details,
    };
  }
}

export const weatherApi = new WeatherApiService();
