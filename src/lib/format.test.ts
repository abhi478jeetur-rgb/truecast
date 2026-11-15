import { describe, expect, it } from "vitest";
import {
  calendarDate,
  clockLabel,
  compassDirection,
  formatDecimal,
  formatTemp,
  formatVisibility,
  hourLabel,
  parseLocal,
  relativeUpdated,
  uvDescriptor,
  weekdayShort,
} from "./format";
import type { Units } from "@/types/weather";

const metric: Units = {
  temperature: "celsius",
  windSpeed: "kmh",
  temperatureLabel: "°C",
  windSpeedLabel: "km/h",
  precipitationLabel: "mm",
};
const imperial: Units = { ...metric, temperature: "fahrenheit", windSpeed: "mph", temperatureLabel: "°F", windSpeedLabel: "mph" };

describe("calendar-safe parsing", () => {
  it("reads the parts of a naive city-local timestamp", () => {
    expect(parseLocal("2026-11-14T08:30")).toMatchObject({
      year: 2026,
      month: 11,
      day: 14,
      hour: 8,
      minute: 30,
      datePart: "2026-11-14",
    });
  });

  it("never shifts the calendar day through the host timezone", () => {
    // 14 Nov 2026 is a Saturday everywhere; the old code rendered Friday in the Americas.
    expect(weekdayShort("2026-11-14")).toBe("Sat");
    expect(weekdayShort("2026-11-15")).toBe("Sun");
    expect(calendarDate("2026-11-14").getDate()).toBe(14);
  });
});

describe("city-local labels", () => {
  it("labels hours on a 12-hour clock", () => {
    expect(hourLabel("2026-11-14T00:00")).toBe("12am");
    expect(hourLabel("2026-11-14T09:30")).toBe("9am");
    expect(hourLabel("2026-11-14T12:00")).toBe("12pm");
    expect(hourLabel("2026-11-14T13:00")).toBe("1pm");
  });

  it("drops the leading zero from clock times", () => {
    expect(clockLabel("2026-11-14T06:49")).toBe("6:49 AM");
    expect(clockLabel("2026-11-14T16:58")).toBe("4:58 PM");
    expect(clockLabel("2026-11-14T00:05")).toBe("12:05 AM");
  });
});

describe("units", () => {
  it("rounds temperatures and keeps integers integer", () => {
    expect(formatTemp(16.4)).toBe("16°");
    // Math.round(-0.4) is -0; "°" strings render it as 0, which is what we want.
    expect(formatTemp(-0.4)).toBe("0°");
    expect(formatTemp(-0.6)).toBe("-1°");
    expect(formatDecimal(1)).toBe("1");
    expect(formatDecimal(1.26)).toBe("1.3");
  });

  it("shows visibility in the reader's system", () => {
    expect(formatVisibility(13_000, metric)).toBe("13 km");
    expect(formatVisibility(1_200, metric)).toBe("1.2 km");
    expect(formatVisibility(4_828.032, imperial)).toBe("3.0 mi");
    expect(formatVisibility(32_186.88, imperial)).toBe("20 mi");
  });
});

describe("descriptors", () => {
  it("maps degrees to compass points", () => {
    expect(compassDirection(0)).toBe("N");
    expect(compassDirection(90)).toBe("E");
    expect(compassDirection(180)).toBe("S");
    expect(compassDirection(350)).toBe("N");
  });

  it("describes UV bands", () => {
    expect(uvDescriptor(0)).toBe("Low");
    expect(uvDescriptor(3)).toBe("Moderate");
    expect(uvDescriptor(6)).toBe("High");
    expect(uvDescriptor(8)).toBe("Very high");
    expect(uvDescriptor(11)).toBe("Extreme");
  });
});

describe("staleness copy", () => {
  const at = 1_000_000_000_000;
  it("says just now, then minutes, then hours", () => {
    expect(relativeUpdated(at, at + 10_000)).toBe("Updated just now");
    expect(relativeUpdated(at, at + 120_000)).toBe("Updated 2 min ago");
    expect(relativeUpdated(at, at + 7_200_000)).toBe("Updated 2 hr ago");
  });

  it("never goes negative when the clock steps back", () => {
    expect(relativeUpdated(at, at - 5_000)).toBe("Updated just now");
  });
});
