import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncDesktopVersion } from "./sync-desktop-version";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

test("synchronizes the private desktop application to the pstdio release version", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-desktop-version-"));
  roots.push(root);
  const runtimePackagePath = join(root, "pstdio.json");
  const desktopPackagePath = join(root, "desktop.json");
  writeFileSync(runtimePackagePath, `${JSON.stringify({ name: "pstdio", version: "1.2.3" }, null, 2)}\n`);
  writeFileSync(desktopPackagePath, `${JSON.stringify({ name: "@pstdio/desktop", version: "1.2.2" }, null, 2)}\n`);

  expect(syncDesktopVersion({ runtimePackagePath, desktopPackagePath })).toBe(true);
  expect(JSON.parse(readFileSync(desktopPackagePath, "utf8")).version).toBe("1.2.3");
  expect(syncDesktopVersion({ runtimePackagePath, desktopPackagePath })).toBe(false);
});
