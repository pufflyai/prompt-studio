import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagePackagedPackageCache } from "./packaged-package-cache";

test("prepared package cache seeds a fresh runtime without creating installed dependencies or replacing its existing cache", () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-package-cache-"));
  try {
    const prepared = join(root, "prepared");
    const home = join(root, "runtime");
    mkdirSync(prepared);
    writeFileSync(join(prepared, "package-archive"), "prepared public artifact");
    symlinkSync(join(prepared, "package-archive"), join(prepared, "alias"));
    stagePackagedPackageCache(home, prepared);
    const archive = join(home, "cache/extension-bun-install/package-archive");
    expect(readFileSync(archive, "utf8")).toBe("prepared public artifact");
    expect(existsSync(join(home, "node_modules"))).toBe(false);
    expect(realpathSync(join(home, "cache/extension-bun-install/alias"))).toStartWith(realpathSync(home));
    writeFileSync(archive, "runtime-owned cache");
    stagePackagedPackageCache(home, prepared);
    expect(readFileSync(archive, "utf8")).toBe("runtime-owned cache");
    expect(readFileSync(join(prepared, "package-archive"), "utf8")).toBe("prepared public artifact");
    rmSync(prepared, { recursive: true });
    expect(readFileSync(join(home, "cache/extension-bun-install/alias"), "utf8")).toBe("runtime-owned cache");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
