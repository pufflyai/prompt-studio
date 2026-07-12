import { describe, expect, test } from "bun:test";
import { resolveColorScaleValue } from "./color-scale-cell";
import type { DataTableColorScaleStop } from "./types";

const twoColorStops: DataTableColorScaleStop[] = [
  { value: 0, color: { light: "red", dark: "darkred" } },
  { value: 100, color: { light: "green", dark: "darkgreen" } },
];

describe("data table color scale", () => {
  test("interpolates color across two stops", () => {
    expect(resolveColorScaleValue(25, twoColorStops)).toEqual({
      light: "color-mix(in srgb, red 75%, green)",
      dark: "color-mix(in srgb, darkred 75%, darkgreen)",
    });
  });

  test("interpolates within the adjacent segment of a multi-stop scale", () => {
    const stops: DataTableColorScaleStop[] = [
      { value: 0, color: { light: "red", dark: "darkred" } },
      { value: 50, color: { light: "orange", dark: "#713f12" } },
      { value: 100, color: { light: "green", dark: "darkgreen" } },
    ];

    expect(resolveColorScaleValue(75, stops)).toEqual({
      light: "color-mix(in srgb, orange 50%, green)",
      dark: "color-mix(in srgb, #713f12 50%, darkgreen)",
    });
  });

  test("resolves hex scale segments to concrete colors", () => {
    const stops: DataTableColorScaleStop[] = [
      { value: 0, color: { light: "#000000", dark: "#ffffff" } },
      { value: 100, color: { light: "#ffffff", dark: "#000000" } },
    ];

    expect(resolveColorScaleValue(50, stops)).toEqual({ light: "#808080", dark: "#808080" });
  });

  test("clamps values to the endpoint colors", () => {
    expect(resolveColorScaleValue(-10, twoColorStops)).toEqual(twoColorStops[0]!.color);
    expect(resolveColorScaleValue(120, twoColorStops)).toEqual(twoColorStops[1]!.color);
  });

  test("does not resolve non-numeric values or unusable scales", () => {
    expect(resolveColorScaleValue("75", twoColorStops)).toBeNull();
    expect(resolveColorScaleValue(Number.NaN, twoColorStops)).toBeNull();
    expect(resolveColorScaleValue(50, [{ value: 0, color: { light: "red", dark: "darkred" } }])).toBeNull();
    expect(
      resolveColorScaleValue(50, [
        { value: 10, color: { light: "red", dark: "darkred" } },
        { value: 10, color: { light: "green", dark: "darkgreen" } },
      ]),
    ).toBeNull();
  });
});
