import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { City, WeatherData } from "@/types/weather";
import {
  messageForError,
  weatherApi,
  type UnitPreferences,
} from "@/services/weatherApi";
import {
  MAX_FAVORITES,
  placeKey,
  readCity,
  readFavorites,
  readUnits,
  writeCity,
  writeFavorites,
  writeUnits,
} from "@/lib/storage";

const AUTO_REFRESH_MS = 10 * 60 * 1000;

export const DEFAULT_CITY: City = {
  id: "default",
  name: "San Francisco",
  country: "United States",
  admin1: "California",
  latitude: 37.7749,
  longitude: -122.4194,
};

export type WeatherStatus = "loading" | "ready" | "error";

export interface WeatherContextValue {
  /** What is actually on screen. Never a placeholder. */
  data: WeatherData | null;
  /** The city the data belongs to — the only source for the city label. */
  city: City;
  status: WeatherStatus;
  /** A request is in flight (first load, city switch, refresh, or retry). */
  isLoading: boolean;
  /** True while newer data is being fetched over data that is still valid. */
  isStale: boolean;
  error: string | null;
  /** Set when a switch failed, so the banner can name the city that didn't load. */
  failedCity: City | null;
  lastUpdated: number | null;
  units: UnitPreferences;
  /** Re-fetches the current city in the requested units. Never converts locally. */
  changeUnits: (units: UnitPreferences) => void;
  favorites: City[];
  isFavorite: (city: City) => boolean;
  toggleFavorite: (city: City) => void;
  removeFavorite: (city: City) => void;
  retry: () => void;
  dismissError: () => void;
  selectCity: (city: City) => void;

  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  query: string;
  setQuery: (query: string) => void;
  results: City[];
  isSearching: boolean;
  searchError: string | null;
}

const WeatherContext = createContext<WeatherContextValue | null>(null);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [city, setCity] = useState<City>(() => readCity() ?? DEFAULT_CITY);
  const [error, setError] = useState<string | null>(null);
  const [failedCity, setFailedCity] = useState<City | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [units, setUnits] = useState<UnitPreferences>(() => readUnits());
  const [favorites, setFavorites] = useState<City[]>(() => readFavorites());

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  /** Guards against an older response overwriting a newer one. */
  const latestRequest = useRef(0);
  /** The first load happens once, not every time `units` recreates `load`. */
  const started = useRef(false);
  /** The city read at startup, before any selection. */
  const initialCity = useRef(city);

  useEffect(() => {
    writeUnits(units);
  }, [units]);

  useEffect(() => {
    writeFavorites(favorites);
  }, [favorites]);

  const load = useCallback(
    async (target: City, options: { force?: boolean; units?: UnitPreferences } = {}) => {
      const requestId = ++latestRequest.current;
      const prefs = options.units ?? units;
      setIsLoading(true);
      try {
        const weather = await weatherApi.fetchWeather(
          target.latitude,
          target.longitude,
          prefs,
          options,
        );
        if (requestId !== latestRequest.current) return;
        // The label always comes from the selection, never from the response —
        // this is what the old refresh path got wrong.
        setData({ ...weather, city: { ...target } });
        setCity(target);
        // Only a successful load becomes the next launch's starting city.
        writeCity(target);
        setLastUpdated(Date.now());
        setError(null);
        setFailedCity(null);
      } catch (err) {
        if (requestId !== latestRequest.current) return;
        setError(messageForError(err));
        setFailedCity(target);
        // Last good data stays on screen; the banner says so explicitly.
      } finally {
        if (requestId === latestRequest.current) setIsLoading(false);
      }
    },
    [units],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load(initialCity.current);
  }, [load]);

  const changeUnits = useCallback(
    (next: UnitPreferences) => {
      if (next.temperature === units.temperature && next.windSpeed === units.windSpeed) return;
      setUnits(next);
      // Ask the API for the new units instead of converting on the client: the
      // number on screen and the response then agree exactly, rounding included.
      // The city is re-fetched, never reset to the default.
      void load(city, { units: next, force: true });
    },
    [units, city, load],
  );

  const isFavorite = useCallback(
    (target: City) => favorites.some((f) => placeKey(f) === placeKey(target)),
    [favorites],
  );

  const toggleFavorite = useCallback((target: City) => {
    setFavorites((previous) => {
      const key = placeKey(target);
      if (previous.some((f) => placeKey(f) === key)) {
        return previous.filter((f) => placeKey(f) !== key);
      }
      return [...previous, { ...target }].slice(-MAX_FAVORITES);
    });
  }, []);

  const removeFavorite = useCallback((target: City) => {
    setFavorites((previous) => previous.filter((f) => placeKey(f) !== placeKey(target)));
  }, []);

  // Refresh the city that is on screen, keeping its full identity (SG-33).
  useEffect(() => {
    const interval = setInterval(() => {
      void load(city, { force: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [city, load]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }
    const controller = new AbortController();
    setIsSearching(true);
    setSearchError(null);
    const timer = setTimeout(async () => {
      try {
        const found = await weatherApi.searchCities(trimmed, controller.signal);
        if (controller.signal.aborted) return;
        setResults(found);
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setSearchError(messageForError(err));
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isSearchOpen]);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
    setQuery("");
    setResults([]);
    setSearchError(null);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const selectCity = useCallback(
    (next: City) => {
      setIsSearchOpen(false);
      setQuery("");
      setResults([]);
      void load(next);
    },
    [load],
  );

  const retry = useCallback(() => {
    void load(failedCity ?? city, { force: true });
  }, [failedCity, city, load]);

  const dismissError = useCallback(() => {
    setError(null);
    setFailedCity(null);
  }, []);

  const status: WeatherStatus = data ? "ready" : error ? "error" : "loading";

  const value = useMemo<WeatherContextValue>(
    () => ({
      data,
      city,
      status,
      isLoading,
      isStale: isLoading && data !== null,
      error,
      failedCity,
      lastUpdated,
      units,
      changeUnits,
      favorites,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      retry,
      dismissError,
      selectCity,
      isSearchOpen,
      openSearch,
      closeSearch,
      query,
      setQuery,
      results,
      isSearching,
      searchError,
    }),
    [
      data,
      city,
      status,
      isLoading,
      error,
      failedCity,
      lastUpdated,
      units,
      changeUnits,
      favorites,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      retry,
      dismissError,
      selectCity,
      isSearchOpen,
      openSearch,
      closeSearch,
      query,
      results,
      isSearching,
      searchError,
    ],
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather(): WeatherContextValue {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error("useWeather must be used inside <WeatherProvider>");
  }
  return context;
}
