import { useEffect } from "react";
import { useWeather } from "@/state/WeatherProvider";
import { themeFor } from "@/lib/theme";

/**
 * Paints the window from the selected city's actual condition and its own
 * sunrise/sunset. The old version read the host clock and the host timezone,
 * which painted Sydney as night at 3 p.m.
 */
export default function WeatherBackground() {
  const { data } = useWeather();

  useEffect(() => {
    if (!data) return;
    const theme = themeFor(data.current.condition.code, data.current.condition.isNight);
    const root = document.documentElement;
    root.style.setProperty("--bg-gradient", theme.gradient);
    root.dataset.theme = theme.dark ? "dark" : "light";
  }, [data]);

  return null;
}
