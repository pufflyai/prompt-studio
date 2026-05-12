import { describe, expect, test } from "bun:test";
import { normalizeExtensionSources } from "pstdio-extensions";
import { buildDashboardExtensionMetadata } from "./dashboard-extension-metadata";

const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: "file:///extension/extension.ts" });

const runtimeWithRoute = (entryPath: string) =>
  normalizeExtensionSources([
    {
      sourcePath: "/extension/extension.ts",
      sourceKind: "local",
      packagePath: "/extension",
      manifest: {
        id: "pstdio.lab",
        name: "lab",
        displayName: "Lab",
        description: "Lab extension for dashboard experiments.",
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        enginesPstdio: "^1.0.0",
      },
      definition: {
        routes: {
          page: {
            path: "lab",
            label: "Lab",
            webview: { entry: asset(entryPath) },
          },
        },
      },
    },
  ]);

describe("buildDashboardExtensionMetadata webview assets", () => {
  test("includes extension description in extension records", () => {
    const runtime = normalizeExtensionSources([
      {
        sourcePath: "/extension/extension.ts",
        sourceKind: "local",
        packagePath: "/extension",
        manifest: {
          id: "pstdio.lab",
          name: "lab",
          displayName: "Lab",
          description: "Lab extension for dashboard experiments.",
          version: "1.0.0",
          publisher: "pstdio",
          main: "./extension.ts",
          enginesPstdio: "^1.0.0",
        },
        definition: {},
      },
    ]);

    const metadata = buildDashboardExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.extensions[0]?.description).toBe("Lab extension for dashboard experiments.");
  });

  test("adds module bridge URLs for managed source webviews", () => {
    const metadata = buildDashboardExtensionMetadata({
      installNamesByExtensionId: new Map([["pstdio.lab", "extension-lab"]]),
      runtime: runtimeWithRoute("./src/main.tsx"),
      webviewCacheRoot: "/cache",
    });

    const webview = metadata.routes[0]?.webview;

    expect(webview?.runtimeUrl).toBe("/v1/extensions/runtime");
    expect(webview?.moduleUrl).toBe("/v1/extensions/installed/extension-lab/webviews/lab.page/module.js");
    expect(webview).not.toHaveProperty("assetUrl");
  });

  test("adds a direct asset URL for static html webviews", () => {
    const metadata = buildDashboardExtensionMetadata({
      installNamesByExtensionId: new Map([["pstdio.lab", "extension-lab"]]),
      runtime: runtimeWithRoute("./static.html"),
      webviewCacheRoot: "/cache",
    });

    const webview = metadata.routes[0]?.webview;

    expect(webview?.assetUrl).toBe("/v1/extensions/installed/extension-lab/webviews/lab.page/");
    expect(webview).not.toHaveProperty("runtimeUrl");
    expect(webview).not.toHaveProperty("moduleUrl");
  });
});
