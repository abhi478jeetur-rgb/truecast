import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react";
import type { WeatherCondition } from "@/types/weather";

interface ConditionIconProps {
  condition: WeatherCondition;
  size?: number;
  className?: string;
}

export default function ConditionIcon({ condition, size = 28, className }: ConditionIconProps) {
  const { code, isNight } = condition;
  const common = { size, strokeWidth: 1.75, className, "aria-hidden": true } as const;

  switch (code) {
    case "clear":
      return isNight ? <Moon {...common} /> : <Sun {...common} />;
    case "partly-cloudy":
      // A moon behind cloud at night; the old build always drew a sun.
      return isNight ? <CloudMoon {...common} /> : <CloudSun {...common} />;
    case "overcast":
      return <Cloud {...common} />;
    case "fog":
      return <CloudFog {...common} />;
    case "drizzle":
      return <CloudDrizzle {...common} />;
    case "rain":
    case "rain-showers":
      return <CloudRain {...common} />;
    case "snow":
    case "snow-showers":
      return <CloudSnow {...common} />;
    case "thunderstorm":
    case "thunderstorm-rain":
      return <CloudLightning {...common} />;
  }
}
