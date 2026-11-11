import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyPreparedFixtures } from "./prepared-fixture-copy";

test("completed preparations yield independent sources with owned dependency links", () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-fixtures-"));
  try {
    const source = join(root, "prepared/source");
    mkdirSync(join(source, "node_modules", "actual"), { recursive: true });
    writeFileSync(join(source, "node_modules/actual/value"), "original");
    symlinkSync("actual", join(source, "node_modules/linked"), process.platform === "win32" ? "junction" : "dir");
    writeFileSync(join(root, "prepared/sources.json"), JSON.stringify({ fixture: source, unselected: "never-read" }));
    const a = copyPreparedFixtures(join(root, "prepared"), join(root, "a"), ["fixture"]);
    const b = copyPreparedFixtures(join(root, "prepared"), join(root, "b"), ["fixture"]);
    writeFileSync(join(a.sources.fixture!, "node_modules/linked/value"), "changed");
    expect(readFileSync(join(b.sources.fixture!, "node_modules/linked/value"), "utf8")).toBe("original");
    expect(readFileSync(join(source, "node_modules/actual/value"), "utf8")).toBe("original");
    expect(a.bytesCopied).toBeGreaterThan(0);
    expect(a.reuseHits).toBe(1);
    expect(Object.keys(a.sources)).toEqual(["fixture"]);
    expect(() => copyPreparedFixtures(join(root, "prepared"), join(root, "c"), ["missing"])).toThrow("missing");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
