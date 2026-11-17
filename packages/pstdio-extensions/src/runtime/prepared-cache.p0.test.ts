import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { maintainPreparedCache, retainPreparedArtifacts } from "./prepared-cache";
import { preparedCacheRoot } from "./prepared-revision";

test("maintenance removes retired artifacts while preserving live process files", () => {
  const previous = process.env.PSTDIO_HOME;
  const home = mkdtempSync(join(tmpdir(), "prepared-cache-"));
  process.env.PSTDIO_HOME = home;
  try {
    const revisions = join(preparedCacheRoot(), "revisions");
    for (const id of ["live", "retired"]) {
      const path = join(revisions, id);
      mkdirSync(path, { recursive: true });
      writeFileSync(join(path, "asset.txt"), id);
      utimesSync(path, new Date(0), new Date(0));
    }
    retainPreparedArtifacts("live");
    maintainPreparedCache();
    expect(existsSync(join(revisions, "live", "asset.txt"))).toBe(true);
    expect(existsSync(join(revisions, "retired"))).toBe(false);
  } finally {
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
});
