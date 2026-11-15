import { useEffect, useState } from "react";
import { ChevronRight, Droplet, MapPin, Star, Wind } from "lucide-react";
import { useWeather } from "@/state/WeatherProvider";
import { CitySearchModal } from "./CitySearchModal";
import { formatTemp, formatWind, longDate, relativeUpdated } from "@/lib/format";

export default function CurrentWeatherHeader() {
  const {
    data,
    city,
    isStale,
    lastUpdated,
    openSearch,
    isSearchOpen,
    closeSearch,
    query,
    setQuery,
    results,
    isSearching,
    searchError,
    selectCity,
    favorites,
    isFavorite,
    toggleFavorite,
    removeFavorite,
  } = useWeather();

  // Keeps "Updated N min ago" honest without re-fetching anything.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (!data) return null;

  const { current, daily, units } = data;
  const favorite = isFavorite(city);
  // The day's range is the day's range — not the current and apparent readings.
  const today = daily[0];

  return (
    <>
      <div className="relative z-20 pt-4 px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
          <button
            onClick={openSearch}
            aria-haspopup="dialog"
            aria-expanded={isSearchOpen}
            aria-label={`Change city, currently ${city.name}`}
            className="chip group flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-full text-app text-sm font-medium transition"
          >
            <MapPin size={14} className="opacity-80" aria-hidden="true" />
            <span className="max-w-[22rem] truncate">{city.name}</span>
            <ChevronRight
              size={14}
              className="opacity-70 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>

          <button
            onClick={() => toggleFavorite(city)}
            aria-pressed={favorite}
            aria-label={
              favorite ? `Remove ${city.name} from favorites` : `Add ${city.name} to favorites`
            }
            title={favorite ? "Remove from favorites" : "Add to favorites"}
            className={`chip flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
              favorite ? "text-app" : "text-app-2 hover:text-app"
            }`}
          >
            <Star size={16} className={favorite ? "fill-current" : ""} aria-hidden="true" />
          </button>
          </div>

          <div className="ml-auto text-right">
            <div className="text-app-2 text-sm font-medium uppercase tracking-[0.08em]">
              {longDate(current.localTime)}
            </div>
            <div className="text-app-3 text-xs mt-1">
              {isStale ? "Updating…" : lastUpdated ? relativeUpdated(lastUpdated, now) : null}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-end gap-3">
          <span className="text-app text-[6rem] font-light leading-[0.9] tracking-[-0.04em] tnum">
            {formatTemp(current.temperature)}
          </span>
          <span className="text-app-2 text-2xl font-medium mb-3">{current.condition.description}</span>
        </div>

        <div className="mt-2 flex items-center gap-3 text-app-2 text-sm tnum">
          <span aria-label={`High ${Math.round(today.maxTemperature)} degrees`}>
            H:{formatTemp(today.maxTemperature)}
          </span>
          <span className="w-px h-3 bg-[color:var(--hairline)]" />
          <span aria-label={`Low ${Math.round(today.minTemperature)} degrees`}>
            L:{formatTemp(today.minTemperature)}
          </span>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-4">
          <div className="text-app-2 text-sm font-medium">
            Feels like {formatTemp(current.apparentTemperature)}
          </div>
          <div className="flex items-center gap-5 text-app-2 text-sm tnum">
            <span className="flex items-center gap-1.5">
              <Droplet size={14} aria-hidden="true" />
              {current.humidity}%
            </span>
            <span className="flex items-center gap-1.5">
              <Wind size={14} aria-hidden="true" />
              {formatWind(current.windSpeed, units)}
            </span>
          </div>
        </div>
      </div>

      <CitySearchModal
        open={isSearchOpen}
        onClose={closeSearch}
        query={query}
        setQuery={setQuery}
        results={results}
        isSearching={isSearching}
        searchError={searchError}
        onSelect={selectCity}
        favorites={favorites}
        onRemoveFavorite={removeFavorite}
      />
    </>
  );
}
