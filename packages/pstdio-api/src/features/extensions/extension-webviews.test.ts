import { describe, expect, test } from "bun:test";
import { classifyWebviewEntry, collectExtensionWebviews } from "./extension-webviews";

const asset = (path: string) => ({
  kind: "package-asset" as const,
  path,
  baseUrl: "file:///tmp/extension/extension.ts",
});

describe("classifyWebviewEntry", () => {
  test("treats html entries as static package assets", () => {
    expect(classifyWebviewEntry(asset("./page.html"))).toEqual({ kind: "static" });
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
  test("collects route, view, settings, and renderer webviews by namespace id", () => {
    const webviews = collectExtensionWebviews({
      metadata: {
        apiVersion: "1",
        id: "pstdio.test",
        name: "Test",
        namespace: "test",
      },
      definition: {
        routes: { page: { webview: { entry: asset("./route.tsx") } } },
        views: { panel: { webview: { entry: asset("./view.tsx") } } },
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
      "test.prefs",
    ]);
  });
});
