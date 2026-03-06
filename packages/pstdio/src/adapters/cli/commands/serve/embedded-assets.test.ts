import { describe, expect, test } from "bun:test";
import { resolveMimeType } from "./embedded-assets";

describe("resolveMimeType", () => {
  test("resolves common web asset types", () => {
    expect(resolveMimeType("index.html")).toBe("text/html");
    expect(resolveMimeType("app.js")).toBe("application/javascript");
    expect(resolveMimeType("style.css")).toBe("text/css");
    expect(resolveMimeType("data.json")).toBe("application/json");
    expect(resolveMimeType("logo.svg")).toBe("image/svg+xml");
    expect(resolveMimeType("photo.png")).toBe("image/png");
  });

  test("resolves font types", () => {
    expect(resolveMimeType("font.woff")).toBe("font/woff");
    expect(resolveMimeType("font.woff2")).toBe("font/woff2");
    expect(resolveMimeType("font.ttf")).toBe("font/ttf");
  });

  test("falls back to octet-stream for unknown extensions", () => {
    expect(resolveMimeType("file.xyz")).toBe("application/octet-stream");
    expect(resolveMimeType("file")).toBe("application/octet-stream");
  });
});
