import { describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createExtensionWebviewAccess } from "./extension-webview-access";
import { createExtensionWebviewAssetRoutes } from "./extension-webview-asset-routes";

const webviewAccess = createExtensionWebviewAccess({
  signingKey: Buffer.from("test-webview-signing-key"),
});
const webviewScope = { installName: "extension-lab", webviewId: "lab.labPage" };
const webviewBasePath = webviewAccess.runtimeUrl(webviewScope).replace(/\/runtime$/, "");

const writeExtension = (root: string, entry: string) => {
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lab",
      version: "1.0.0",
      displayName: "Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(join(root, "src", "main.tsx"), "console.log('managed');");
  writeFileSync(join(root, "static.html"), '<!doctype html><script src="./static.js"></script>');
  writeFileSync(join(root, "static.js"), "console.log('static');");
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
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

const createApp = (input: { cacheRoot: string; sourcePath: string; lastErrorJson?: unknown; failure?: string }) => {
  const app = new OpenAPIHono();
  app.route(
    "/v1",
    createExtensionWebviewAssetRoutes({
      extensionService: {
        getInstalledSource: async (installName: string) => {
          if (input.failure) throw new Error(input.failure);
          return installName === "extension-lab"
            ? {
                install_name: "extension-lab",
                source_path: input.sourcePath,
                last_error_json: input.lastErrorJson,
              }
            : null;
        },
      },
      extensionWebviewAccess: webviewAccess,
      webviewCacheRoot: input.cacheRoot,
    } as never),
  );
  app.all("*", (c) => c.text("session realm", 401));
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
      const html = await app.request(`${webviewBasePath}/runtime`);

      expect(html.status).toBe(200);
      expect(html.headers.get("content-type")).toContain("text/html");
      expect(html.headers.get("referrer-policy")).toBe("no-referrer");
      const body = await html.text();
      expect(body).toContain("pstdio-extension-mount");
      expect(body).not.toContain("esm.sh");
      expect(body).not.toContain("<script src=");
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
      const res = await app.request(`${webviewBasePath}/assets/module.js`);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/javascript");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(await res.text()).toBe("console.log('managed');");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns a throwing JS module when the managed bundle is missing and a build error is recorded", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-error-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, "./src/main.tsx");

    try {
      const app = createApp({
        cacheRoot,
        sourcePath,
        lastErrorJson: {
          code: "extension_webview_build_failed",
          message: 'Could not resolve: "react"',
          webviewId: "lab.labPage",
        },
      });
      const res = await app.request(`${webviewBasePath}/assets/module.js`);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/javascript");
      const body = await res.text();
      expect(body).toContain("throw new Error(");
      expect(body).toContain('Could not resolve: \\"react\\"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("falls through to 404 when no build error is recorded and the bundle is missing", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-no-error-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, "./src/main.tsx");

    try {
      const app = createApp({ cacheRoot, sourcePath });
      const res = await app.request(`${webviewBasePath}/assets/module.js`);

      expect(res.status).toBe(404);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects path traversal outside the selected webview root", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-assets-traversal-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, "./src/main.tsx");
    mkdirSync(join(cacheRoot, "extension-lab", "lab.labPage", "dist"), { recursive: true });
    writeFileSync(join(cacheRoot, "extension-lab", "lab.labPage", "dist", "module.js"), "console.log('managed');");
    writeFileSync(join(root, "secret.txt"), "secret");

    try {
      const app = createApp({ cacheRoot, sourcePath });
      const res = await app.request(`${webviewBasePath}/assets/..%2Fsecret.txt`);

      expect(res.status).toBe(404);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("owns invalid requests without falling through to the session realm", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-realm-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, "./src/main.tsx");

    try {
      const app = createApp({ cacheRoot, sourcePath });
      const invalidCapability = await app.request(`${webviewBasePath}x/runtime`, {
        headers: { origin: "null" },
      });
      const mutation = await app.request(`${webviewBasePath}/runtime`, {
        headers: { origin: "null" },
        method: "POST",
      });
      const foreignOrigin = await app.request(`${webviewBasePath}/runtime`, {
        headers: { origin: "https://attacker.example" },
      });

      expect(invalidCapability.status).toBe(404);
      expect(await invalidCapability.text()).not.toContain("session realm");
      expect(mutation.status).toBe(404);
      expect(await mutation.text()).not.toContain("session realm");
      expect(foreignOrigin.status).toBe(403);
      expect(await foreignOrigin.text()).not.toContain("session realm");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("serves opaque-origin GET and HEAD without cookies", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-opaque-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, "./src/main.tsx");

    try {
      const app = createApp({ cacheRoot, sourcePath });
      const get = await app.request(`${webviewBasePath}/runtime`, {
        headers: { origin: "null" },
      });
      const head = await app.request(`${webviewBasePath}/runtime`, {
        headers: { origin: "null" },
        method: "HEAD",
      });

      expect(get.status).toBe(200);
      expect(get.headers.get("access-control-allow-origin")).toBe("null");
      expect(get.headers.get("access-control-allow-credentials")).toBeNull();
      expect(head.status).toBe(200);
      expect(await head.text()).toBe("");
      expect(head.headers.get("access-control-allow-origin")).toBe("null");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("redacts capability values from asset errors and logs", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-redaction-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    const failure = `failed to load http://127.0.0.1:43123${webviewBasePath}/assets/module.js`;
    const capability = webviewBasePath.split("/")[4]!;
    const stdout = spyOn(process.stdout, "write").mockReturnValue(true);
    writeExtension(sourcePath, "./src/main.tsx");

    try {
      const app = createApp({ cacheRoot, failure, sourcePath });
      const response = await app.request(`${webviewBasePath}/assets/module.js`, {
        headers: { origin: "null" },
      });
      const body = await response.text();
      const logs = stdout.mock.calls.map((call) => String(call[0])).join("\n");

      expect(response.status).toBe(500);
      expect(body).not.toContain(capability);
      expect(logs).not.toContain(capability);
      expect(body).toContain("[Redacted]");
      expect(logs).toContain("[Redacted]");
    } finally {
      stdout.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
