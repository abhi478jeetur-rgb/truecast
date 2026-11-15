import WeatherBackground from "@/components/WeatherBackground";
import TitleBar from "@/components/TitleBar";
import CurrentWeatherHeader from "@/components/CurrentWeatherHeader";
import HourlyForecastStrip from "@/components/HourlyForecastStrip";
import TenDayForecast from "@/components/TenDayForecast";
import WeatherDetailGrid from "@/components/WeatherDetailGrid";
import { useWeather } from "@/state/WeatherProvider";

export default function App() {
  const { data, city, status, error, isStale, failedCity, retry, dismissError } = useWeather();

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden font-sans selection:bg-blue-500/30">
      <WeatherBackground />
      <TitleBar />
      <div className="relative z-10 h-full w-full overflow-y-auto overflow-x-hidden">
        <main className="pt-16 px-6 pb-20">
          {status === "loading" && <LoadingState />}

          {status === "error" && (
            <ErrorState message={error ?? "Unable to load weather."} onRetry={retry} />
          )}

          {data && (
            <>
              <h1 className="sr-only">{city.name} weather</h1>
              <CurrentWeatherHeader />
              {error && (
                <StaleNotice
                  cityName={failedCity?.name}
                  message={error}
                  onRetry={retry}
                  onDismiss={dismissError}
                />
              )}
              <div
                aria-busy={isStale}
                className={`transition-opacity duration-300 ${isStale ? "opacity-55" : "opacity-100"}`}
              >
                <HourlyForecastStrip hourly={data.hourly} />
                {/* Side by side only when the right column is wide enough for
                    two readable cards. At 800-899 px a 5/12 column squeezed them
                    to 118 px and the labels wrapped, so it collapses to one
                    column and the details follow the forecast. */}
                <div className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-6">
                  <div className="min-[900px]:col-span-7 min-w-0">
                    <TenDayForecast daily={data.daily} />
                  </div>
                  <div className="min-[900px]:col-span-5 min-w-0">
                    <WeatherDetailGrid details={data.details} units={data.units} />
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className="h-[60vh] flex flex-col items-center justify-center gap-5"
      aria-busy="true"
      aria-label="Loading weather"
    >
      <div
        className="h-24 w-64 rounded-3xl animate-pulse"
        style={{ backgroundColor: "var(--skeleton)" }}
      />
      <div
        className="h-4 w-40 rounded-full animate-pulse"
        style={{ backgroundColor: "var(--skeleton)" }}
      />
      <p className="text-app-3 text-sm font-medium">Loading weather…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-app text-xl font-semibold mb-2">Weather is unavailable</h1>
      <p className="text-app-2 text-sm max-w-sm mb-6">{message}</p>
      <button
        onClick={onRetry}
        className="chip text-app rounded-full px-5 py-2 text-sm font-medium transition"
      >
        Try again
      </button>
    </div>
  );
}

function StaleNotice({
  cityName,
  message,
  onRetry,
  onDismiss,
}: {
  cityName?: string;
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="px-6 mt-6" role="status" aria-live="polite">
      <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-app text-sm font-medium">
          {cityName ? `Couldn't update ${cityName}.` : "Couldn't update."}
        </span>
        <span className="text-app-2 text-sm flex-1 min-w-[12rem]">
          Showing the last reading{message ? ` — ${message}` : "."}
        </span>
        <button
          onClick={onRetry}
          className="chip text-app rounded-full px-3 py-1 text-sm font-medium transition"
        >
          Retry
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss update notice"
          className="text-app-3 hover:text-app text-sm px-2 transition"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
