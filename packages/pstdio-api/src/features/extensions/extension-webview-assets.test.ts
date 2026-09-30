import { describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, webviewAccess, webviewBasePath, writeExtension } from "./test-utils/webview-asset-app";

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
    mkdirSync(join(cacheRoot, "installed-lab", "pstdio.lab.view.labPage", "dist"), { recursive: true });
    writeFileSync(
      join(cacheRoot, "installed-lab", "pstdio.lab.view.labPage", "dist", "module.js"),
      "console.log('managed');",
    );

    try {
      let loads = 0;
      let invalidate: (() => void) | undefined;
      const app = createApp({
        cacheRoot,
        sourcePath,
        onCatalog: (catalog) => {
          invalidate = () => catalog.invalidate({ sourcePath, reason: "source_changed" });
        },
        onLoad: () => {
          loads += 1;
        },
      });
      for (let request = 0; request < 5; request += 1) {
        expect((await app.request(`${webviewBasePath}/assets/module.js`)).status).toBe(200);
      }
      const res = await app.request(`${webviewBasePath}/assets/module.js`);
      expect(loads).toBe(1);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/javascript");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(await res.text()).toBe("console.log('managed');");
      invalidate!();
      await Promise.all(
        Array.from({ length: 5 }, async () => {
          expect((await app.request(`${webviewBasePath}/assets/module.js`)).status).toBe(200);
        }),
      );
      expect(loads).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("serves the bundle of the installed source named in the URL when sources share an install name", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-shared-install-name-"));
    const cacheRoot = join(root, "cache");
    const sources = ["workspace-copy", "project-copy"].map((id) => {
      const sourcePath = join(root, id, "font-editor");
      writeExtension(sourcePath, "./src/main.tsx");
      mkdirSync(join(cacheRoot, id, "pstdio.lab.view.labPage", "dist"), { recursive: true });
      writeFileSync(join(cacheRoot, id, "pstdio.lab.view.labPage", "dist", "module.js"), `console.log('${id}');`);
      return { id, install_name: "font-editor", source_path: sourcePath };
    });

    try {
      const app = createApp({ cacheRoot, sourcePath: sources[0]!.source_path, sources });
      const moduleUrl = webviewAccess.assetUrl(
        { installedExtensionId: "project-copy", webviewId: "pstdio.lab.view.labPage" },
        "module.js",
      );
      const res = await app.request(moduleUrl);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("console.log('project-copy');");
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
          webviewId: "pstdio.lab.view.labPage",
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
    mkdirSync(join(cacheRoot, "installed-lab", "pstdio.lab.view.labPage", "dist"), { recursive: true });
    writeFileSync(
      join(cacheRoot, "installed-lab", "pstdio.lab.view.labPage", "dist", "module.js"),
      "console.log('managed');",
    );
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
