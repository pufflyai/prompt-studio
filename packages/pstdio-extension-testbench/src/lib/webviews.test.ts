import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageAsset } from "@pstdio/sdk/extensions";
import { createPreviewWebviewHost } from "./webviews";

describe("createPreviewWebviewHost", () => {
  test("resolves webview assets against the current app origin", async () => {
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

      const input = {
        extensionId: "pstdio.lab",
        extensionName: "lab",
        id: "lab.panel",
        sourcePath,
        webview: { entry: packageAsset("./view.ts", `file://${sourcePath}`) },
      };
      await host.prepareWebviews([input]);
      const webview = host.resolveWebview(input);

      origin = "http://127.0.0.1:6174";

      expect(webview?.runtimeUrl).toBe("http://localhost:6173/__extension-testbench/runtime.html");
      expect(webview?.moduleUrl).toBe("http://localhost:6173/__extension-testbench/webviews/lab.panel/module.js");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("prepares independent webview builds concurrently", async () => {
    const root = join(tmpdir(), `pstdio-extension-testbench-${crypto.randomUUID()}`);
    const sourcePath = join(root, "extension.ts");
    const cacheRoot = join(root, "cache");
    let releaseBuilds = () => {};
    const buildsReleased = new Promise<void>((resolve) => {
      releaseBuilds = resolve;
    });
    let startedBuilds = 0;

    mkdirSync(root, { recursive: true });
    writeFileSync(sourcePath, "export {};\n");
    writeFileSync(join(root, "first.ts"), "export {};\n");
    writeFileSync(join(root, "second.ts"), "export {};\n");

    try {
      const host = createPreviewWebviewHost({
        apiPrefix: "/__extension-testbench",
        cacheRoot,
        buildWebview: async ({ distDir }) => {
          startedBuilds += 1;
          await buildsReleased;
          mkdirSync(distDir, { recursive: true });
          writeFileSync(join(distDir, "module.js"), "export {};\n");
          return undefined;
        },
      });
      const inputs = ["first", "second"].map((id) => ({
        extensionId: "pstdio.lab",
        extensionName: "lab",
        id: `lab.${id}`,
        sourcePath,
        webview: { entry: packageAsset(`./${id}.ts`, `file://${sourcePath}`) },
      }));

      const preparing = host.prepareWebviews(inputs);
      try {
        expect(startedBuilds).toBe(2);
      } finally {
        releaseBuilds();
      }
      await preparing;

      expect(host.resolveWebview(inputs[0]!)?.moduleUrl).toBe("/__extension-testbench/webviews/lab.first/module.js");
      expect(host.resolveWebview(inputs[1]!)?.moduleUrl).toBe("/__extension-testbench/webviews/lab.second/module.js");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
