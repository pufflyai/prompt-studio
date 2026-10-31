import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { installExtensionSource, removePathBestEffort } from "./install-extension-source";
import { promotePreparedSource } from "./promote-extension-source";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const createTree = () => {
  const root = mkdtempSync(join(tmpdir(), "extension-update-responsiveness-"));
  roots.push(root);
  const prepared = join(root, "staging/tool");
  for (let index = 0; index < 100; index++) {
    const dependency = join(prepared, "node_modules", `dependency-${index}`, "lib");
    mkdirSync(dependency, { recursive: true });
    writeFileSync(join(dependency, "index.js"), "export default {};\n");
  }
  return { root, prepared };
};

test("removes the previous extension dependencies before cleanup completes", async () => {
  const { root } = createTree();
  await removePathBestEffort(root);

  expect(existsSync(root)).toBe(false);
});

test("waits for pending cleanup while unrelated event-loop work can run", async () => {
  const { root } = createTree();
  const gate = Promise.withResolvers<void>();
  let completed = false;
  // Hold cleanup explicitly: fast filesystem operations can finish before an immediate runs.
  const cleanup = removePathBestEffort(root, async (path) => {
    await gate.promise;
    await rm(path, { recursive: true, force: true });
  }).then(() => {
    completed = true;
  });

  try {
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(completed).toBe(false);
    expect(existsSync(root)).toBe(true);
  } finally {
    gate.resolve();
    await cleanup;
  }
  expect(completed).toBe(true);
  expect(existsSync(root)).toBe(false);
});

test("promotes an extension with nested dependencies", async () => {
  const { root, prepared } = createTree();
  const installed = join(root, "extensions/tool");
  mkdirSync(join(root, "extensions"));
  await promotePreparedSource(prepared, installed, false, false);

  expect(existsSync(join(installed, "node_modules/dependency-99/lib/index.js"))).toBe(true);
});

test("replaces multiple extensions concurrently without retaining old dependencies or staging folders", async () => {
  const home = mkdtempSync(join(tmpdir(), "concurrent-extension-updates-"));
  roots.push(home);
  const sources = ["notes", "artifacts"].map((name) => {
    const { root, prepared } = createTree();
    const target = join(home, "extensions", name);
    mkdirSync(join(home, "extensions"), { recursive: true });
    // The old install has dependencies; the replacement no longer needs them.
    const source = join(root, name);
    mkdirSync(source);
    const manifest = {
      name,
      publisher: "test",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    };
    writeFileSync(join(prepared, "package.json"), JSON.stringify({ ...manifest, version: "1.0.0" }));
    writeFileSync(join(prepared, "extension.ts"), "export default {};\n");
    writeFileSync(join(source, "package.json"), JSON.stringify({ ...manifest, version: "2.0.0" }));
    writeFileSync(join(source, "extension.ts"), "export default { commands: [] };\n");
    return { source, prepared, target };
  });
  for (const { prepared, target } of sources) await promotePreparedSource(prepared, target, false, false);

  await Promise.all(
    sources.map(({ source, target }) =>
      installExtensionSource({ source, force: true, skipInstall: true, env: { PSTDIO_HOME: home } }).then((result) => {
        expect(result.targetPath).toBe(target);
        expect(result.metadata.version).toBe("2.0.0");
      }),
    ),
  );

  for (const { target } of sources) {
    expect(readFileSync(join(target, "extension.ts"), "utf8")).toContain("commands: []");
    expect(existsSync(join(target, "node_modules"))).toBe(false);
  }
  expect(readdirSync(home)).toEqual(["extensions"]);
});
