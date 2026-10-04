import { describe, expect, test } from "bun:test";
import {
  createDashboardRuntimeConfigPlugin,
  injectDashboardRuntimeConfig,
  resolveTerminalWebSocketUrl,
  resolveWebviewOrigin,
} from "./vite-runtime-config";

describe("resolveWebviewOrigin", () => {
  test("serves extension webviews straight from the API the proxy targets", () => {
    expect(resolveWebviewOrigin({ apiProxyTarget: "http://localhost:19841" })).toBe("http://*.localhost:19841");
  });

  test("keeps an explicit browser-reachable webview origin", () => {
    expect(
      resolveWebviewOrigin({ apiProxyTarget: "http://localhost:19841", webviewOrigin: "http://*.localhost:52311" }),
    ).toBe("http://*.localhost:52311");
  });
});

describe("resolveTerminalWebSocketUrl", () => {
  test("preserves a complete explicit browser-reachable terminal endpoint", () => {
    expect(
      resolveTerminalWebSocketUrl({
        apiProxyTarget: "http://127.0.0.1:19841",
        terminalWebSocketUrl: "wss://dashboard.example/prefix/pty?channel=dev",
      }),
    ).toBe("wss://dashboard.example/prefix/pty?channel=dev");
  });

  test("derives the terminal endpoint from the server-side API proxy target", () => {
    expect(resolveTerminalWebSocketUrl({ apiProxyTarget: "https://api.example/internal" })).toBe(
      "wss://api.example/v1/terminal",
    );
  });

  test("rejects credentials in the browser-visible terminal endpoint", () => {
    expect(() =>
      resolveTerminalWebSocketUrl({
        apiProxyTarget: "http://127.0.0.1:19841",
        terminalWebSocketUrl: "ws://user:secret@localhost:19841/v1/terminal",
      }),
    ).toThrow("must not contain credentials");
  });
});

describe("dashboard runtime config injection", () => {
  test("injects an encoded terminal endpoint into served HTML", () => {
    const html = injectDashboardRuntimeConfig("<html><head></head><body></body></html>", {
      terminalWebSocketUrl: "ws://localhost:19841/v1/terminal",
      webviewOrigin: "http://*.localhost:19841",
    });
    const encoded = html.match(/<meta name="pstdio-config" content="([^"]+)">/)?.[1];

    expect(encoded).toBeDefined();
    expect(JSON.parse(decodeURIComponent(encoded ?? ""))).toEqual({
      terminalWebSocketUrl: "ws://localhost:19841/v1/terminal",
      webviewOrigin: "http://*.localhost:19841",
    });
  });

  test("registers one serve-only adapter for Vite development and preview", () => {
    const plugin = createDashboardRuntimeConfigPlugin({
      terminalWebSocketUrl: "ws://localhost:19841/v1/terminal",
      webviewOrigin: "http://*.localhost:19841",
    });

    expect(plugin.apply).toBe("serve");
    expect(plugin.transformIndexHtml).toBeDefined();
    expect(plugin.configurePreviewServer).toBeDefined();
  });
});
