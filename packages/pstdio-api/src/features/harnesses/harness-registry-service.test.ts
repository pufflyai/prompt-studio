import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createApp } from "../../app";
import { installExtensionSource } from "../extensions/install-extension-source";

const REPO_ROOT = resolve(import.meta.dir, "../../../../..");

describe("harness registry", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-harness-registry-"));

  afterAll(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("resolves harnesses from extensions the user installed into PSTDIO_HOME, before any project exists", async () => {
    // The user decides what lives in PSTDIO_HOME/extensions (`pst extensions add`);
    // the host only loads what is there.
    process.env.PSTDIO_HOME = join(tempRoot, "home");
    await installExtensionSource({ source: resolve(REPO_ROOT, "extensions/pstdio-fake-harness") });

    const { app, close } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
    });

    try {
      const res = await app.request("/v1/agents/info");
      const agents = (await res.json()) as Array<{ id: string; name: string; availability: { type: string } }>;

      expect(agents).toEqual([
        { id: "pstdio.pstdio-fake-harness.fake", name: "Fake Agent", availability: { type: "INSTALLED" } },
      ]);
    } finally {
      await close();
    }
  }, 40_000);
});
