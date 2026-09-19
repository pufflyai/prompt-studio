import { describe, expect, test } from "bun:test";
import { canGrantSessionPermission } from "./session-permissions";

describe("desktop clipboard permissions", () => {
  const runtimeOrigin = "http://127.0.0.1:43127";
  const request = {
    permission: "clipboard-sanitized-write",
    requestingUrl: `${runtimeOrigin}/projects/one`,
    isMainFrame: true,
    runtimeOrigin,
  };

  test("allows the runtime page to write copied text", () => {
    expect(canGrantSessionPermission(request)).toBe(true);
  });

  test.each(["clipboard-read", "geolocation", "notifications", "media"])("denies %s", (permission) => {
    expect(canGrantSessionPermission({ ...request, permission })).toBe(false);
  });

  test.each([
    "https://example.com",
    "http://127.0.0.1:43128",
    "http://127.0.0.1:43127.example.com",
    "pstdio://lifecycle/index.html",
    "about:blank",
    "invalid",
    undefined,
  ])("denies clipboard writes from %s", (requestingUrl) => {
    expect(canGrantSessionPermission({ ...request, requestingUrl })).toBe(false);
  });

  test("denies subframes and requests without an active runtime", () => {
    expect(canGrantSessionPermission({ ...request, isMainFrame: false })).toBe(false);
    expect(canGrantSessionPermission({ ...request, runtimeOrigin: null })).toBe(false);
  });
});
