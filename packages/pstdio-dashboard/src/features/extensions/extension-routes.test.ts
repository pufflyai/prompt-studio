import { describe, expect, it } from "bun:test";
import type { ExtensionRouteRecord } from "pstdio-api-contracts";
import { buildExtensionRouteAssetUrl, getExtensionRouteByPath } from "./extension-routes";

const route = {
  id: "lab.labPage",
  extensionId: "pstdio.extension-lab",
  path: "lab",
  label: "Lab",
  webview: {
    entry: {
      kind: "package-asset",
      path: "./dist/lab-page.html",
      baseUrl: "file:///tmp/extensions/lab/extension.ts",
    },
  },
} satisfies ExtensionRouteRecord;

describe("extension routes", () => {
  it("finds a route by normalized project path segment", () => {
    expect(getExtensionRouteByPath([route], "/lab/")).toBe(route);
  });

  it("builds a proxied asset URL for the route entry", () => {
    expect(buildExtensionRouteAssetUrl(route)).toBe("/v1/extensions/routes/lab.labPage/assets/lab-page.html");
  });
});
