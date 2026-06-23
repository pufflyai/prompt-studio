import { describe, expect, test } from "bun:test";
import { normalizeSvgForImage, resolveSvgSize } from "./svg-data-url";

describe("resolveSvgSize", () => {
  test("uses viewBox dimensions when present", () => {
    const svg = `<svg viewBox="0 0 120 240" width="10" height="20"></svg>`;
    expect(resolveSvgSize(svg)).toEqual({ width: 120, height: 240 });
  });

  test("falls back to width and height attributes when viewBox is missing", () => {
    const svg = `<svg width="50" height="30"></svg>`;
    expect(resolveSvgSize(svg)).toEqual({ width: 50, height: 30 });
  });
});

describe("normalizeSvgForImage", () => {
  test("rewrites HTML5 <br> inside foreignObject to self-closing form so the SVG parses as XML", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><p>one<br>two</p></div></foreignObject></svg>`;
    const normalized = normalizeSvgForImage(svg);
    expect(normalized).not.toContain("<br>");
    expect(normalized).toContain("<br/>");
  });
});
