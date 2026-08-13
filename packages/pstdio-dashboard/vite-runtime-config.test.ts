import { describe, expect, test } from "bun:test";
import {
  createDashboardRuntimeConfigPlugin,
  injectDashboardRuntimeConfig,
  resolveTerminalWebSocketUrl,
} from "./vite-runtime-config";

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
    });
    const encoded = html.match(/<meta name="pstdio-config" content="([^"]+)">/)?.[1];

    expect(encoded).toBeDefined();
    expect(JSON.parse(decodeURIComponent(encoded ?? ""))).toEqual({
      terminalWebSocketUrl: "ws://localhost:19841/v1/terminal",
    });
  });

  test("registers one serve-only adapter for Vite development and preview", () => {
    const plugin = createDashboardRuntimeConfigPlugin({
      terminalWebSocketUrl: "ws://localhost:19841/v1/terminal",
    });

    expect(plugin.apply).toBe("serve");
    expect(plugin.transformIndexHtml).toBeDefined();
    expect(plugin.configurePreviewServer).toBeDefined();
  });
});
