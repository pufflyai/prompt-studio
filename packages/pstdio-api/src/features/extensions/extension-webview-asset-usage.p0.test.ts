import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, webviewBasePath, writeExtension } from "./test-utils/webview-asset-app";

for (const method of ["GET", "HEAD"]) {
  test(`waits for a first-use build before serving ${method} assets`, async () => {
    const root = mkdtempSync(join(tmpdir(), "webview-first-use-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, "./src/main.tsx");
    const started = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    let finished = false;
    const app = createApp({
      cacheRoot,
      sourcePath,
      ensureWebviews: async (installName) => {
        expect(installName).toBe("installed-lab");
        started.resolve();
        await released.promise;
        const dist = join(cacheRoot, "installed-lab/pstdio.lab.view.labPage/dist");
        mkdirSync(dist, { recursive: true });
        writeFileSync(join(dist, "module.js"), "export default 42;");
      },
    });
    try {
      const response = Promise.resolve(app.request(`${webviewBasePath}/assets/module.js`, { method })).then((value) => {
        finished = true;
        return value;
      });
      await started.promise;
      expect(finished).toBe(false);
      released.resolve();
      const result = await response;
      expect(result.status).toBe(200);
      expect(result.headers.get("cache-control")).toBe("no-store");
      expect(await result.text()).toBe(method === "HEAD" ? "" : "export default 42;");
    } finally {
      released.resolve();
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("resolves the requested view's current entry stylesheet after checking its output", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-webview-css-"));
  try {
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    const dist = join(cacheRoot, "installed-lab", "pstdio.lab.view.labPage", "dist");
    writeExtension(sourcePath, "./src/main.tsx");
    mkdirSync(dist, { recursive: true });
    writeFileSync(join(dist, "module.js"), "export default {}");
    const checked: string[] = [];
    const app = createApp({
      cacheRoot,
      sourcePath,
      ensureWebviews: async (id, view) => {
        checked.push(`${id}/${view}`);
      },
    });
    const style = `${webviewBasePath}/stylesheet`;
    expect((await app.request(style.replace("installed-lab", "another-install"))).status).toBe(404);
    expect(checked).toEqual([]);
    const empty = await app.request(style);
    expect(empty.status).toBe(200);
    expect(empty.headers.get("content-type")).toContain("text/css");
    expect(await empty.text()).toBe("");
    writeFileSync(join(dist, "entry-style.txt"), "entry-2.css");
    writeFileSync(join(dist, "entry-2.css"), ".fresh{color:red}");
    writeFileSync(join(dist, "build-signature.txt"), "fresh");
    const response = await app.request(`${style}?h=stale`);
    expect(response.status).toBe(307);
    const location = response.headers.get("location")!;
    expect(location).toBe(`${webviewBasePath}/assets/entry-2.css?h=fresh`);
    expect(await (await app.request(location)).text()).toBe(".fresh{color:red}");
    const broken = createApp({
      cacheRoot,
      sourcePath,
      lastErrorJson: {
        code: "extension_webview_build_failed",
        message: "failed",
        webviewId: "pstdio.lab.view.labPage",
      },
    });
    expect((await broken.request(style)).status).toBe(404);
    expect(checked).toEqual(Array(3).fill("installed-lab/pstdio.lab.view.labPage"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
