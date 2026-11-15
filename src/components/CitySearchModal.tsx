import { useEffect, useRef } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import type { City } from "@/types/weather";

interface CitySearchModalProps {
  open: boolean;
  onClose: () => void;
  query: string;
  setQuery: (q: string) => void;
  results: City[];
  isSearching: boolean;
  searchError: string | null;
  onSelect: (city: City) => void;
  /** Saved places, shown when the field is empty so they are one click away. */
  favorites: City[];
  onRemoveFavorite: (city: City) => void;
}

export function CitySearchModal({
  open,
  onClose,
  query,
  setQuery,
  results,
  isSearching,
  searchError,
  onSelect,
  favorites,
  onRemoveFavorite,
}: CitySearchModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  /** One ref per favourites row, so removing one can hand focus to the next. */
  const removeRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Return focus to the trigger. Programmatic/assistive opens often leave
      // activeElement on <body>, so fall back to the city button explicitly.
      const trigger = document.querySelector<HTMLElement>('[aria-haspopup="dialog"]');
      const previous = previousFocus.current;
      const target =
        previous && previous !== document.body && previous.isConnected ? previous : trigger;
      target?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="app-region-no-drag absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-title"
        /* The sheet is always light, so it must opt into the light token set:
           otherwise the dark theme's white focus ring is drawn on white and
           keyboard focus on Cancel / a result row becomes invisible. */
        data-theme="light"
        className="relative w-full max-w-md mx-4 h-[min(40rem,calc(100vh-1.5rem))] bg-white/95 backdrop-blur rounded-3xl border border-white/60 shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Search size={18} aria-hidden="true" />
            </div>
            <h2 id="search-title" className="text-slate-900 text-lg font-semibold">
              Search city
            </h2>
          </div>
        </div>

        <div className="p-4 flex flex-1 min-h-0 flex-col">
          <div className="relative mb-4">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={16} aria-hidden="true" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && results.length > 0) {
                  event.preventDefault();
                  onSelect(results[0]);
                }
              }}
              placeholder="Enter city name"
              aria-label="Enter city name"
              className="app-region-no-drag w-full pl-10 pr-12 py-3 rounded-2xl border border-slate-200 bg-slate-50/60 focus:border-blue-500 transition text-slate-900 placeholder-slate-600 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                title="Clear search"
                className="app-region-no-drag absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          <div aria-live="polite" className="min-h-[1rem]">
            {isSearching && <p className="text-center py-2 text-slate-600 text-sm">Searching…</p>}
            {!isSearching && searchError && (
              <p className="text-center py-2 text-slate-600 text-sm">
                <span className="block font-medium text-slate-800">Couldn't search for cities</span>
                {searchError}
              </p>
            )}
            {!isSearching && !searchError && query.trim() && results.length === 0 && (
              <p className="text-center py-2 text-slate-600 text-sm">
                No cities found for “{query.trim()}”
              </p>
            )}
            {!isSearching && !searchError && results.length > 0 && (
              <p className="pb-1 text-xs text-slate-600 tnum">
                {results.length} {results.length === 1 ? "result" : "results"}
              </p>
            )}
            {!query.trim() && favorites.length > 0 && (
              <p className="sr-only">
                {favorites.length} favorite {favorites.length === 1 ? "city" : "cities"}
              </p>
            )}
          </div>

          <div className="mt-1 min-h-0 max-h-96 flex-1 overflow-y-auto pr-1 snap-y snap-proximity">
            {!query.trim() && favorites.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-600">
                Search for a city, open it, then use the star beside its name to keep it
                here for one-click access, even after you restart the app.
              </p>
            )}

            {!query.trim() && favorites.length > 0 && (
              <>
                <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                  Favorites
                </p>
                {favorites.map((city, index) => (
                  <div
                    key={`${city.latitude.toFixed(3)},${city.longitude.toFixed(3)}`}
                    className="flex items-center gap-1"
                  >
                    <button
                      onClick={() => onSelect(city)}
                      className="app-region-no-drag flex-1 flex items-center justify-between gap-3 px-4 py-3 text-left rounded-xl hover:bg-blue-50 transition text-slate-800 snap-start"
                    >
                      <span className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{city.name}</span>
                        <span className="text-xs text-slate-600 truncate">
                          {city.admin1 ? city.admin1 + ", " : ""}
                          {city.country}
                        </span>
                      </span>
                      <ArrowRight size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
                    </button>
                    <button
                      ref={(node) => {
                        removeRefs.current[index] = node;
                      }}
                      onClick={() => {
                        onRemoveFavorite(city);
                        // Keep the keyboard user in the list rather than dropping
                        // focus to <body> when their row disappears.
                        requestAnimationFrame(() => {
                          const next =
                            removeRefs.current[index] ??
                            removeRefs.current[index - 1] ??
                            removeRefs.current[0];
                          // Last row removed: the list is gone, so land on the
                          // field the user came to use, not on <body>.
                          (next ?? inputRef.current)?.focus();
                        });
                      }}
                      aria-label={`Remove ${city.name} from favorites`}
                      title="Remove from favorites"
                      className="app-region-no-drag w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </>
            )}

            {query.trim() && results.map((city) => (
              <button
                key={city.id}
                onClick={() => onSelect(city)}
                className="app-region-no-drag w-full flex items-center justify-between gap-3 px-4 py-3 text-left rounded-xl hover:bg-blue-50 transition text-slate-800 snap-start"
              >
                <span className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{city.name}</span>
                  <span className="text-xs text-slate-600 truncate">
                    {city.admin1 ? city.admin1 + ", " : ""}
                    {city.country}
                  </span>
                </span>
                <ArrowRight size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200/70 bg-white/80">
          <button
            onClick={onClose}
            className="app-region-no-drag w-full py-2.5 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
