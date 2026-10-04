import { describe, expect, test } from "bun:test";
import { isWebviewPath, webviewHostLabel, webviewOriginLabel } from "./webview-origin";

describe("webviewOriginLabel", () => {
  test("gives each installed extension its own stable host label", () => {
    const planner = webviewOriginLabel("installed-planner");

    expect(planner).toMatch(/^ext-[0-9a-f]{24}$/);
    expect(webviewOriginLabel("installed-planner")).toBe(planner);
    expect(webviewOriginLabel("installed-notes")).not.toBe(planner);
  });
});

describe("webviewHostLabel", () => {
  const label = webviewOriginLabel("installed-planner");

  test("reads the label from an extension webview host", () => {
    expect(webviewHostLabel(`${label}.localhost:19840`)).toBe(label);
    expect(webviewHostLabel(`${label}.localhost`)).toBe(label);
    expect(webviewHostLabel(`${label.toUpperCase()}.LOCALHOST:19840`)).toBe(label);
  });

  test("does not treat other hosts as webview hosts", () => {
    expect(webviewHostLabel("127.0.0.1:19840")).toBeNull();
    expect(webviewHostLabel("localhost:5173")).toBeNull();
    expect(webviewHostLabel("app.localhost:19840")).toBeNull();
    expect(webviewHostLabel(`nested.${label}.localhost:19840`)).toBeNull();
    expect(webviewHostLabel(undefined)).toBeNull();
  });
});

describe("isWebviewPath", () => {
  test("matches only extension webview resources", () => {
    expect(isWebviewPath("/v1/extensions/webviews/cap/install/view/runtime")).toBe(true);
    expect(isWebviewPath("/v1/extensions/webviews")).toBe(true);
    expect(isWebviewPath("/v1/projects")).toBe(false);
    expect(isWebviewPath("/v1/extensions/webviewsx")).toBe(false);
    expect(isWebviewPath("/")).toBe(false);
  });
});
