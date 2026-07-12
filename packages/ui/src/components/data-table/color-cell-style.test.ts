import { describe, expect, test } from "bun:test";
import { contrastRatioForHexColors, resolveColorCellStyle, resolveReadableTextColor } from "./color-cell-style";

describe("data table color cell style", () => {
  test("uses a matching readable text color on light backgrounds", () => {
    const foreground = resolveReadableTextColor("#bbf7d0");

    expect(foreground).not.toBe("#111827");
    expect(foreground).not.toBe("#ffffff");
    expect(contrastRatioForHexColors(foreground, "#bbf7d0")).toBeGreaterThanOrEqual(4.5);
  });

  test("uses a matching readable text color on dark backgrounds", () => {
    const foreground = resolveReadableTextColor("#14532d");

    expect(foreground).not.toBe("#111827");
    expect(foreground).not.toBe("#ffffff");
    expect(contrastRatioForHexColors(foreground, "#14532d")).toBeGreaterThanOrEqual(4.5);
  });

  test("builds theme-reactive cell colors", () => {
    expect(resolveColorCellStyle({ light: "#bbf7d0", dark: "#14532d" })).toEqual({
      backgroundColor: "light-dark(#bbf7d0, #14532d)",
      color: expect.stringMatching(/^light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\)$/),
    });
  });

  test("honors explicit themed foreground colors", () => {
    expect(
      resolveColorCellStyle({
        light: "var(--light-bg)",
        dark: "var(--dark-bg)",
        foreground: { light: "var(--light-fg)", dark: "var(--dark-fg)" },
      }),
    ).toEqual({
      backgroundColor: "light-dark(var(--light-bg), var(--dark-bg))",
      color: "light-dark(var(--light-fg), var(--dark-fg))",
    });
  });
});
