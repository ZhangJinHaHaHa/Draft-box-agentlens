import { describe, expect, it } from "vitest";

import {
  ART_THEMES,
  ART_THEME_DEFAULT_VERSION,
  DEFAULT_ART_THEME,
  normalizeArtTheme,
  resolveInitialArtTheme,
} from "./theme";

describe("theme art backgrounds", () => {
  it("exposes the Stitch art directions", () => {
    expect(ART_THEMES).toEqual(["swiss", "atelier", "nocturne", "pixel", "crimson"]);
    expect(DEFAULT_ART_THEME).toBe("swiss");
  });

  it("normalizes legacy art themes into the Stitch directions", () => {
    expect(normalizeArtTheme("aqua")).toBe("atelier");
    expect(normalizeArtTheme("flora")).toBe("atelier");
    expect(normalizeArtTheme("sierra")).toBe("nocturne");
    expect(normalizeArtTheme("vangogh")).toBe("nocturne");
    expect(normalizeArtTheme("monet")).toBe("atelier");
    expect(normalizeArtTheme("klimt")).toBe("atelier");
  });

  it("falls back to the default Swiss Precision direction for unknown values", () => {
    expect(normalizeArtTheme(undefined)).toBe("swiss");
    expect(normalizeArtTheme("unknown")).toBe("swiss");
    expect(normalizeArtTheme("swiss")).toBe("swiss");
    expect(normalizeArtTheme("pixel")).toBe("pixel");
    expect(normalizeArtTheme("crimson")).toBe("crimson");
  });

  it("migrates the stale previous default while preserving explicit choices", () => {
    expect(resolveInitialArtTheme(null, null)).toBe("swiss");
    expect(resolveInitialArtTheme("atelier", null)).toBe("swiss");
    expect(resolveInitialArtTheme("nocturne", null)).toBe("swiss");
    expect(resolveInitialArtTheme("nocturne", ART_THEME_DEFAULT_VERSION)).toBe("nocturne");
    expect(resolveInitialArtTheme("atelier", ART_THEME_DEFAULT_VERSION)).toBe("atelier");
  });
});
