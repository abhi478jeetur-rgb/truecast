export type WeatherCode =
  | "clear"
  | "partly-cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "rain-showers"
  | "snow"
  | "snow-showers"
  | "thunderstorm"
  | "thunderstorm-rain";

export type TemperatureUnit = "celsius" | "fahrenheit";
export type WindSpeedUnit = "kmh" | "mph";

/** Units are requested from the API, and the labels come back from it too. */
export interface Units {
  temperature: TemperatureUnit;
  windSpeed: WindSpeedUnit;
  /** e.g. "°C" — the API's own label, never a guess. */
  temperatureLabel: string;
  /** e.g. "km/h" */
  windSpeedLabel: string;
  /** e.g. "mm" */
  precipitationLabel: string;
}

export interface WeatherCondition {
  code: WeatherCode;
  description: string;
  icon: string;
  isNight: boolean;
}

export interface CurrentWeather {
  /** City-local ISO timestamp, no offset: "2026-11-14T08:30". */
  localTime: string;
  temperature: number;
  apparentTemperature: number;
  condition: WeatherCondition;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  /** Metres, exactly as returned by the API. Format at the edge. */
  visibilityMetres: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
  precipitation: number;
}

export interface HourlyForecast {
  /** City-local ISO timestamp, no offset. */
  time: string;
  temperature: number;
  condition: WeatherCondition;
  precipitationProbability: number;
  /** True for the single entry that represents the city's current hour. */
  isCurrent: boolean;
}

export interface DailyForecast {
  /** City-local calendar date: "2026-11-14". */
  date: string;
  dayName: string;
  maxTemperature: number;
  minTemperature: number;
  condition: WeatherCondition;
  precipitationProbability: number;
  sunrise: string;
  sunset: string;
  isToday: boolean;
}

export interface WeatherDetails {
  uvIndex: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  /** Metres, exactly as returned by the API. */
  visibilityMetres: number;
  pressure: number;
  sunrise: string;
  sunset: string;
}

export interface City {
  id: string;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export interface WeatherData {
  city: City;
  timezone: string;
  utcOffsetSeconds: number;
  units: Units;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  details: WeatherDetails;
}
