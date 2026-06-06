import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageAsset } from "@pstdio/sdk/extensions";
import { createPreviewWebviewHost } from "./webviews";

describe("createPreviewWebviewHost", () => {
  test("resolves webview assets against the current app origin", () => {
    const root = join(tmpdir(), `pstdio-extension-testbench-${crypto.randomUUID()}`);
    const sourcePath = join(root, "extension.ts");
    const viewPath = join(root, "view.ts");
    const cacheRoot = join(root, "cache");

    mkdirSync(root, { recursive: true });
    writeFileSync(sourcePath, "export {};\n");
    writeFileSync(viewPath, "export default {};\n");

    try {
      let origin = "http://localhost:6173";
      const host = createPreviewWebviewHost({
        apiOrigin: () => origin,
        apiPrefix: "/__extension-testbench",
        cacheRoot,
      });

      const webview = host.resolveWebview({
        extensionId: "pstdio.lab",
        extensionName: "lab",
        id: "lab.panel",
        sourcePath,
        webview: { entry: packageAsset("./view.ts", `file://${sourcePath}`) },
      });

      origin = "http://127.0.0.1:6174";

      expect(webview?.runtimeUrl).toBe("http://localhost:6173/__extension-testbench/runtime.html");
      expect(webview?.moduleUrl).toBe("http://localhost:6173/__extension-testbench/webviews/lab.panel/module.js");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
