import { Clock } from "lucide-react";
import type { HourlyForecast } from "@/types/weather";
import ConditionIcon from "./ConditionIcon";
import { formatTemp, hourLabel } from "@/lib/format";

interface HourlyForecastStripProps {
  hourly: HourlyForecast[];
}

export default function HourlyForecastStrip({ hourly }: HourlyForecastStripProps) {
  return (
    <section aria-labelledby="hourly-heading" className="z-20 px-6 pt-4">
      <div className="flex items-center justify-between mb-4 px-4 gap-4">
        <h2
          id="hourly-heading"
          className="text-app text-sm font-semibold tracking-[0.06em] uppercase"
        >
          Hourly forecast
        </h2>
        <div className="flex items-center gap-1.5 text-app-3 text-xs">
          <Clock size={12} aria-hidden="true" />
          <span>Next {hourly.length} hours</span>
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-3 scroll-x pb-2">
          {hourly.map((hour) => (
            <div
              key={hour.time}
              className={`flex flex-col items-center gap-3 w-16 min-w-[64px] px-2 py-3 rounded-2xl text-center transition ${
                hour.isCurrent
                  ? "glass-strong text-app shadow-sm"
                  : "glass-subtle text-app-2"
              }`}
            >
              <span className={`text-xs font-medium ${hour.isCurrent ? "text-app" : "text-app-2"}`}>
                {hour.isCurrent ? "Now" : hourLabel(hour.time)}
              </span>
              <ConditionIcon condition={hour.condition} size={16} />
              <span className={`text-sm font-medium tnum ${hour.isCurrent ? "text-app" : "text-app-2"}`}>
                {formatTemp(hour.temperature)}
              </span>
              {/* Shape as well as the number: a 48 px track whose fill is the
                  probability. Zero-probability hours keep the space but stay
                  invisible, so the strip does not flicker. */}
              <div
                className={`w-full flex flex-col items-center gap-1 ${
                  hour.precipitationProbability > 0 ? "" : "opacity-0"
                }`}
                aria-hidden={hour.precipitationProbability === 0}
              >
                <span className="w-full h-1 rounded-full bg-[color:var(--hairline)] overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-sky-300"
                    style={{ width: `${hour.precipitationProbability}%` }}
                  />
                </span>
                <span className="text-[10px] tnum text-app-3">
                  {hour.precipitationProbability}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
