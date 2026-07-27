import { describe, expect, test } from "bun:test";
import { classifyWebviewEntry, collectExtensionWebviews } from "./extension-webviews";

const asset = (path: string) => ({
  kind: "package-asset" as const,
  path,
  baseUrl: "file:///tmp/extension/extension.ts",
});

describe("classifyWebviewEntry", () => {
  test("rejects html entries because webviews are bridge-backed", () => {
    expect(classifyWebviewEntry(asset("./page.html"))).toEqual({ extension: ".html", kind: "unsupported" });
  });

  test("treats browser source entries as managed Bun webviews", () => {
    for (const path of ["./page.ts", "./page.tsx", "./page.js", "./page.jsx", "./page.mts", "./page.mjs"]) {
      expect(classifyWebviewEntry(asset(path))).toEqual({ kind: "managed" });
    }
  });

  test("rejects unsupported webview entry extensions", () => {
    expect(classifyWebviewEntry(asset("./page.md"))).toEqual({ extension: ".md", kind: "unsupported" });
  });
});

describe("collectExtensionWebviews", () => {
  test("collects route, Panel, nested Panel Menu, settings, and renderer webviews by package name id", () => {
    const webviews = collectExtensionWebviews({
      metadata: {
        id: "pstdio.test",
        name: "test",
        displayName: "Test",
        version: "1.0.0",
        enginesPstdio: "^1.0.0",
      },
      definition: {
        routes: { page: { webview: { entry: asset("./route.tsx") } } },
        panels: {
          panel: {
            webview: { entry: asset("./view.tsx") },
            panelMenus: {
              inspector: { side: "right", webview: { entry: asset("./inspector.tsx") } },
            },
          },
        },
        settingsPanels: { prefs: { webview: { entry: asset("./settings.tsx") } } },
        activityRenderers: { activity: { webview: { entry: asset("./activity.tsx") } } },
        sessionAnchorRenderers: { anchor: { webview: { entry: asset("./anchor.tsx") } } },
      },
    });

    expect(webviews.map((webview) => webview.id).sort()).toEqual([
      "test.activity",
      "test.anchor",
      "test.page",
      "test.panel",
      "test.panel.inspector",
      "test.prefs",
    ]);
  });
});
