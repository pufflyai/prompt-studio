import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createExtensionRoutes } from "./routes";

const writeExtension = (root: string, entry: string) => {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "main.tsx"), "console.log('managed');");
  writeFileSync(join(root, "static.html"), '<!doctype html><script src="./static.js"></script>');
  writeFileSync(join(root, "static.js"), "console.log('static');");
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      id: "pstdio.lab",
      namespace: "lab",
      name: "Lab",
      apiVersion: "1",
      routes: {
        labPage: {
          path: "lab",
          label: "Lab",
          webview: { entry: { kind: "package-asset", path: "${entry}", baseUrl: import.meta.url } },
        },
      },
    };`,
  );
};

const createApp = (input: { cacheRoot: string; sourcePath: string }) => {
  const app = new OpenAPIHono();
  app.route(
    "/v1",
    createExtensionRoutes({
      extensionService: {
        getInstalledSource: async (installName: string) =>
          installName === "extension-lab"
            ? {
                install_name: "extension-lab",
                source_path: input.sourcePath,
              }
            : null,
      },
      webviewCacheRoot: input.cacheRoot,
    } as never),
  );
  return app;
};

describe("extension webview asset routes", () => {
  test("serves the extension-owned bridge runtime script", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-runtime-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, "./src/main.tsx");

    try {
      const app = createApp({ cacheRoot, sourcePath });
      const html = await app.request("/v1/extensions/runtime");
      const script = await app.request("/v1/extensions/runtime.js");

      expect(html.status).toBe(200);
      expect(html.headers.get("content-type")).toContain("text/html");
      expect(await html.text()).toContain('src="/v1/extensions/runtime.js"');
      expect(script.status).toBe(200);
      expect(script.headers.get("content-type")).toContain("application/javascript");
      expect(await script.text()).not.toContain("esm.sh");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("serves managed webview output from the Prompt Studio cache", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-assets-managed-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, "./src/main.tsx");
    mkdirSync(join(cacheRoot, "extension-lab", "lab.labPage", "dist"), { recursive: true });
    writeFileSync(join(cacheRoot, "extension-lab", "lab.labPage", "dist", "module.js"), "console.log('managed');");

    try {
      const app = createApp({ cacheRoot, sourcePath });
      const res = await app.request("/v1/extensions/installed/extension-lab/webviews/lab.labPage");

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/javascript");
      expect(await res.text()).toBe("console.log('managed');");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("serves static html package assets without using the managed cache", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-assets-static-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, "./static.html");

    try {
      const app = createApp({ cacheRoot, sourcePath });
      const html = await app.request("/v1/extensions/installed/extension-lab/webviews/lab.labPage");
      const script = await app.request("/v1/extensions/installed/extension-lab/webviews/lab.labPage/static.js");

      expect(html.status).toBe(200);
      expect(await html.text()).toContain("./static.js");
      expect(script.status).toBe(200);
      expect(await script.text()).toBe("console.log('static');");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects path traversal outside the selected webview root", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-assets-traversal-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, "./static.html");
    writeFileSync(join(root, "secret.txt"), "secret");

    try {
      const app = createApp({ cacheRoot, sourcePath });
      const res = await app.request("/v1/extensions/installed/extension-lab/webviews/lab.labPage/..%2Fsecret.txt");

      expect(res.status).toBe(404);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
