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
      expect(await result.text()).toBe(method === "HEAD" ? "" : "export default 42;");
    } finally {
      released.resolve();
      rmSync(root, { recursive: true, force: true });
    }
  });
}
