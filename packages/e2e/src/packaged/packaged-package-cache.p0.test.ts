import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagePackagedPackageCache } from "./packaged-package-cache";

test("a runtime uses its run-owned package cache without creating installed dependencies or replacing existing caches", () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-package-cache-"));
  try {
    const prepared = join(root, "prepared");
    const home = join(root, "runtime");
    mkdirSync(prepared);
    writeFileSync(join(prepared, "package-archive"), "prepared public artifact");
    stagePackagedPackageCache(home, prepared);
    const cache = join(home, "cache/extension-bun-install");
    expect(realpathSync(cache)).toBe(realpathSync(prepared));
    expect(readFileSync(join(cache, "package-archive"), "utf8")).toBe("prepared public artifact");
    expect(existsSync(join(home, "node_modules"))).toBe(false);
    rmSync(home, { recursive: true });
    expect(readFileSync(join(prepared, "package-archive"), "utf8")).toBe("prepared public artifact");
    mkdirSync(cache, { recursive: true });
    writeFileSync(join(cache, "existing"), "runtime-owned cache");
    stagePackagedPackageCache(home, prepared);
    expect(readFileSync(join(cache, "existing"), "utf8")).toBe("runtime-owned cache");
    expect(realpathSync(cache)).not.toBe(realpathSync(prepared));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
