import { describe, expect, test } from "bun:test";
import { normalizeBrowserPreviewUrl } from "./browser-preview-url";

const policy = {
  dashboardOrigin: "http://localhost:5173",
  apiOrigin: "http://localhost:3000",
};

describe("normalizeBrowserPreviewUrl", () => {
  test("normalizes shorthand localhost addresses", () => {
    expect(normalizeBrowserPreviewUrl("localhost:5174", policy)).toEqual({
      ok: true,
      url: "http://localhost:5174/",
    });
  });

  test("preserves path, query, and hash for web URLs", () => {
    expect(normalizeBrowserPreviewUrl("https://example.test/app?tab=1#top", policy)).toEqual({
      ok: true,
      url: "https://example.test/app?tab=1#top",
    });
  });

  test("rejects unsupported schemes", () => {
    expect(normalizeBrowserPreviewUrl("file:///tmp/index.html", policy)).toEqual({
      ok: false,
      reason: "unsupported-scheme",
      message: "Browser Preview supports only HTTP(S) URLs.",
    });
  });

  test("rejects URL credentials", () => {
    expect(normalizeBrowserPreviewUrl("https://user:pass@example.test", policy)).toEqual({
      ok: false,
      reason: "credentials",
      message: "Browser Preview URLs cannot include credentials.",
    });
  });

  test("rejects dashboard and API origins", () => {
    expect(normalizeBrowserPreviewUrl("http://127.0.0.1:5173/app", policy)).toEqual({
      ok: false,
      reason: "host-origin",
      message: "Browser Preview cannot open the Prompt Studio host origin.",
    });
    expect(normalizeBrowserPreviewUrl("http://localhost:3000/v1/projects", policy)).toEqual({
      ok: false,
      reason: "host-origin",
      message: "Browser Preview cannot open the Prompt Studio host origin.",
    });
  });

  test("rejects invalid input", () => {
    expect(normalizeBrowserPreviewUrl("not a host name", policy)).toEqual({
      ok: false,
      reason: "invalid-url",
      message: "Browser Preview URL is invalid.",
    });
  });
});
