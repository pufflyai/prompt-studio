import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyPreparedFixtures } from "./prepared-fixture-copy";

test("completed preparations yield independent sources with owned internal links", () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-fixtures-"));
  try {
    const source = join(root, "prepared/source");
    mkdirSync(join(source, "assets", "actual"), { recursive: true });
    writeFileSync(join(source, "assets/actual/value"), "original");
    symlinkSync("actual", join(source, "assets/linked"), process.platform === "win32" ? "junction" : "dir");
    writeFileSync(join(root, "prepared/sources.json"), JSON.stringify({ fixture: source, unselected: "never-read" }));
    const a = copyPreparedFixtures(join(root, "prepared"), join(root, "a"), ["fixture"]);
    const b = copyPreparedFixtures(join(root, "prepared"), join(root, "b"), ["fixture"]);
    writeFileSync(join(a.sources.fixture!, "assets/linked/value"), "changed");
    expect(readFileSync(join(b.sources.fixture!, "assets/linked/value"), "utf8")).toBe("original");
    expect(readFileSync(join(source, "assets/actual/value"), "utf8")).toBe("original");
    expect(a.bytesCopied).toBeGreaterThan(0);
    expect(a.reuseHits).toBe(1);
    expect(Object.keys(a.sources)).toEqual(["fixture"]);
    expect(() => copyPreparedFixtures(join(root, "prepared"), join(root, "c"), ["missing"])).toThrow("missing");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a private consumer installs its declared dependencies without copying the prepared install", async () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-install-"));
  try {
    const dependency = join(root, "dependency");
    const prepared = join(root, "prepared");
    const source = join(prepared, "source");
    mkdirSync(dependency, { recursive: true });
    writeFileSync(
      join(dependency, "package.json"),
      JSON.stringify({ name: "fixture-dependency", version: "1.0.0", main: "index.js" }),
    );
    writeFileSync(join(dependency, "index.js"), "export const value='installed';");
    const packed = Bun.spawnSync([process.execPath, "pm", "pack", "--destination", root], { cwd: dependency });
    expect(packed.exitCode).toBe(0);
    mkdirSync(join(source, "node_modules/fixture-dependency"), { recursive: true });
    writeFileSync(join(source, "node_modules/fixture-dependency/index.js"), "stale prepared dependency");
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({
        name: "fixture-consumer",
        dependencies: { "fixture-dependency": `file:${join(root, "fixture-dependency-1.0.0.tgz")}` },
      }),
    );
    writeFileSync(join(prepared, "sources.json"), JSON.stringify({ fixture: source }));
    const copied = copyPreparedFixtures(prepared, join(root, "consumer"), ["fixture"]);
    const installed = Bun.spawnSync([process.execPath, "install", "--ignore-scripts"], {
      cwd: copied.sources.fixture!,
    });
    expect(installed.exitCode).toBe(0);
    expect(readFileSync(join(copied.sources.fixture!, "node_modules/fixture-dependency/index.js"), "utf8")).toContain(
      "installed",
    );
    expect(readFileSync(join(source, "node_modules/fixture-dependency/index.js"), "utf8")).toBe(
      "stale prepared dependency",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
