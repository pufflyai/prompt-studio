import { expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PackageAssetDescriptor } from "@pstdio/sdk/extensions";
import { resolvePackageAssetPath } from "pstdio-extensions";
import { loadExtensionSource } from "./extension-runtime";
import { installExtensionSource } from "./install-extension-source";
import { makeExtension } from "./install-extension-source-test-fixtures";

test.each(["promoted", "in-place"])("keeps %s install assets at their final source location", async (mode) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "extension-install-assets-")));
  const home = join(root, "home");
  const source = mode === "promoted" ? join(root, "source") : join(home, "extensions", "test");
  makeExtension(source);
  try {
    const installed = await installExtensionSource({
      source,
      installName: "test",
      skipInstall: true,
      env: { PSTDIO_HOME: home },
    });
    const templates = installed.manifest.templates as Array<{ source: PackageAssetDescriptor }>;
    expect(resolvePackageAssetPath(templates[0]!.source)).toBe(join(installed.targetPath, "ticket.md"));
    expect(installed.check.extensions[0]?.sourcePath).toBe(join(installed.targetPath, "extension.ts"));
    const discovered = await loadExtensionSource(installed.targetPath);
    expect(JSON.parse(JSON.stringify(installed.manifest))).toEqual(JSON.parse(JSON.stringify(discovered.manifest)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
