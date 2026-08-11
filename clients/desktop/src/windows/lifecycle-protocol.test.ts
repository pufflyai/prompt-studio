import { describe, expect, test } from "bun:test";
import { resolveLifecycleAssetPath } from "./lifecycle-protocol";

describe("desktop lifecycle protocol", () => {
  test("resolves only lifecycle assets inside the renderer root", () => {
    expect(resolveLifecycleAssetPath("pstdio://lifecycle/", "/app/renderer")).toBe("/app/renderer/index.html");
    expect(resolveLifecycleAssetPath("pstdio://lifecycle/assets/app.js", "/app/renderer")).toBe(
      "/app/renderer/assets/app.js",
    );
    expect(resolveLifecycleAssetPath("pstdio://other/index.html", "/app/renderer")).toBeNull();
    expect(resolveLifecycleAssetPath("pstdio://lifecycle/%2e%2e/secret", "/app/renderer")).toBeNull();
  });
});
