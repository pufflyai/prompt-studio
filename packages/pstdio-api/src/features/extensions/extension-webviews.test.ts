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
  test("collects every webview body from views and ignores placements that reuse them", () => {
    const webviews = collectExtensionWebviews({
      metadata: {
        id: "pstdio.test",
        name: "test",
        displayName: "Test",
        version: "1.0.0",
        enginesPstdio: "^1.0.0",
      },
      definition: {
        views: [
          { id: "page", title: "Page", body: { kind: "webview", entry: asset("./page.tsx") } },
          { id: "panel", title: "Panel", body: { kind: "webview", entry: asset("./panel.tsx") } },
          { id: "inspector", title: "Inspector", body: { kind: "webview", entry: asset("./inspector.tsx") } },
          { id: "prefs", title: "Preferences", body: { kind: "webview", entry: asset("./settings.tsx") } },
          { id: "status", title: "Status", body: { kind: "webview", entry: asset("./status.tsx") } },
          { id: "tree", title: "Tree", body: { kind: "tree", body: () => [] } },
        ],
        settingsPanels: [{ id: "prefs", view: { kind: "view", id: "prefs" }, slot: { id: "project.settings" } }],
        statusBarItems: [{ id: "status", view: { kind: "view", id: "status" }, slot: { id: "status-bar.leading" } }],
      } as never,
    });

    expect(webviews.map((webview) => webview.id).sort()).toEqual([
      "pstdio.test.view.inspector",
      "pstdio.test.view.page",
      "pstdio.test.view.panel",
      "pstdio.test.view.prefs",
      "pstdio.test.view.status",
    ]);
  });
});
