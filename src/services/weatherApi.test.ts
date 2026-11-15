import { describe, expect, it } from "vitest";
import { isNightAt, messageForError } from "./weatherApi";

const sun = new Map([
  ["2026-11-14", { sunrise: "2026-11-14T06:49", sunset: "2026-11-14T16:58" }],
  ["2026-11-15", { sunrise: "2026-11-15T06:50", sunset: "2026-11-15T16:57" }],
]);

describe("day and night from the city's own sun", () => {
  it("is night before sunrise", () => {
    expect(isNightAt("2026-11-14T05:00", sun)).toBe(true);
  });

  it("is day at and after sunrise", () => {
    expect(isNightAt("2026-11-14T06:49", sun)).toBe(false);
    expect(isNightAt("2026-11-14T12:00", sun)).toBe(false);
  });

  it("is day until sunset, night at and after it", () => {
    expect(isNightAt("2026-11-14T16:57", sun)).toBe(false);
    expect(isNightAt("2026-11-14T16:58", sun)).toBe(true);
  });

  it("uses that date's sun, not today's", () => {
    expect(isNightAt("2026-11-15T06:49", sun)).toBe(true);
    expect(isNightAt("2026-11-15T06:50", sun)).toBe(false);
  });

  it("falls back to day when a date has no sun data", () => {
    expect(isNightAt("2026-12-01T23:00", sun)).toBe(false);
  });
});

describe("error copy", () => {
  it("passes a real message through", () => {
    expect(messageForError(new Error("boom"))).toBe("boom");
  });

  it("never leaks a non-Error to the screen", () => {
    expect(messageForError({})).toBe("Something went wrong loading the weather.");
  });
});
