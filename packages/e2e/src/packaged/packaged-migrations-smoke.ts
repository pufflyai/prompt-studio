import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerPackagedMigrationSmokeTests = () => {
  test("migrates without touching shared temporary files and removes its private extraction", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-migrations-"));
    const home = join(root, "home");
    const sharedTemp = join(root, "shared-tmp");
    const oldExtraction = join(sharedTemp, "pstdio-drizzle");
    mkdirSync(home);
    mkdirSync(oldExtraction, { recursive: true });
    const marker = join(oldExtraction, "marker.sql");
    writeFileSync(marker, "owned by another runtime");
    let child: ChildProcess | undefined;
    try {
      const runtime = await startPackagedServe(home, { TMPDIR: sharedTemp, TMP: sharedTemp, TEMP: sharedTemp });
      child = runtime.child;
      expect(readFileSync(marker, "utf8")).toBe("owned by another runtime");
      expect(readdirSync(home).filter((name) => name.startsWith("pstdio-drizzle-"))).toEqual([]);
      if (process.platform !== "win32") expect(statSync(home).mode & 0o777).toBe(0o700);
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  });
};
