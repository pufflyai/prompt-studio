import { describe, expect, test } from "bun:test";
import { normalizeExtensionSources } from "pstdio-extensions";
import { buildDashboardExtensionMetadata } from "./dashboard-extension-metadata";

const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: "file:///extension/extension.ts" });

const runtimeWithRoute = (entryPath: string) =>
  normalizeExtensionSources([
    {
      sourcePath: "/extension/extension.ts",
      sourceKind: "local",
      definition: {
        id: "pstdio.lab",
        namespace: "lab",
        name: "Lab",
        apiVersion: "1",
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
