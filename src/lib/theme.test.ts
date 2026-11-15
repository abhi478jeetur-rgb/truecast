import { describe, expect, it } from "vitest";
import { themeFor } from "./theme";

describe("theme selection", () => {
  it("uses a light surface for a clear day", () => {
    expect(themeFor("clear", false).dark).toBe(false);
  });

  it("uses a dark surface for a clear night", () => {
    expect(themeFor("clear", true).dark).toBe(true);
  });

  it("keeps an overcast day dark on purpose", () => {
    // A grey sky behind white glass measured 3.9:1; the surface is dark by design.
    expect(themeFor("overcast", false).dark).toBe(true);
  });

  it("keeps a snowy day light", () => {
    expect(themeFor("snow", false).dark).toBe(false);
  });

  it("is dark for rain, day or night", () => {
    expect(themeFor("rain", false).dark).toBe(true);
    expect(themeFor("rain", true).dark).toBe(true);
  });
});
