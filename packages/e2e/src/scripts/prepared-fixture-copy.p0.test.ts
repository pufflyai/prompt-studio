import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preparePackagedExtensionSource } from "../packaged/packaged-extension-source";
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

test("source-only preparation retains a lockfile that supports a fresh frozen consumer install", async () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-lockfile-"));
  try {
    const dependency = join(root, "dependency");
    const input = join(root, "input");
    mkdirSync(dependency);
    mkdirSync(input);
    writeFileSync(
      join(dependency, "package.json"),
      JSON.stringify({ name: "prepared-dependency", version: "1.0.0", main: "index.js" }),
    );
    writeFileSync(join(dependency, "index.js"), "export const value='fresh';");
    expect(Bun.spawnSync([process.execPath, "pm", "pack", "--destination", root], { cwd: dependency }).exitCode).toBe(
      0,
    );
    writeFileSync(
      join(input, "package.json"),
      JSON.stringify({
        name: "prepared-consumer",
        dependencies: {
          "prepared-dependency": `file:${join(root, "prepared-dependency-1.0.0.tgz")}`,
        },
      }),
    );
    const prepared = join(root, "prepared");
    const source = await preparePackagedExtensionSource(prepared, input);
    expect(await Bun.file(join(source, "bun.lock")).exists()).toBe(true);
    expect(await Bun.file(join(source, "node_modules/prepared-dependency/index.js")).exists()).toBe(false);
    writeFileSync(join(prepared, "sources.json"), JSON.stringify({ fixture: source }));
    const copied = copyPreparedFixtures(prepared, join(root, "consumer"), ["fixture"]);
    expect(
      Bun.spawnSync([process.execPath, "install", "--frozen-lockfile", "--ignore-scripts"], {
        cwd: copied.sources.fixture!,
      }).exitCode,
    ).toBe(0);
    expect(readFileSync(join(copied.sources.fixture!, "node_modules/prepared-dependency/index.js"), "utf8")).toContain(
      "fresh",
    );
    expect(await Bun.file(join(source, "node_modules/prepared-dependency/index.js")).exists()).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("independent sources consume the same prepared public package artifact", async () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-public-artifact-"));
  try {
    const dependency = join(root, "sdk");
    const input = join(root, "extension");
    mkdirSync(dependency);
    mkdirSync(input);
    writeFileSync(join(dependency, "package.json"), JSON.stringify({ name: "@pstdio/sdk", version: "1.0.0" }));
    writeFileSync(join(dependency, "value.txt"), "prepared artifact");
    expect(Bun.spawnSync([process.execPath, "pm", "pack", "--destination", root], { cwd: dependency }).exitCode).toBe(
      0,
    );
    writeFileSync(
      join(input, "package.json"),
      JSON.stringify({ name: "consumer", dependencies: { "@pstdio/sdk": "9.0.0" } }),
    );
    const artifact = join(root, "pstdio-sdk-1.0.0.tgz");
    for (const name of ["first", "second"]) {
      const source = await preparePackagedExtensionSource(join(root, name), input, {
        packageArtifacts: { "@pstdio/sdk": artifact },
      });
      expect(JSON.parse(readFileSync(join(source, "package.json"), "utf8")).dependencies["@pstdio/sdk"]).toBe(
        `file:${artifact}`,
      );
      expect(
        Bun.spawnSync([process.execPath, "install", "--frozen-lockfile", "--ignore-scripts"], { cwd: source }).exitCode,
      ).toBe(0);
      expect(readFileSync(join(source, "node_modules/@pstdio/sdk/value.txt"), "utf8")).toBe("prepared artifact");
      writeFileSync(join(source, "private-state.txt"), name);
    }
    expect(readFileSync(join(dependency, "value.txt"), "utf8")).toBe("prepared artifact");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
