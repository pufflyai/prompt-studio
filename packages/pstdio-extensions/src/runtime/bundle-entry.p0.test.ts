import { expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleEntry } from "./bundle-entry";

test("reports the unresolved dependency when an extension cannot be bundled", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-error-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export { default } from "missing-desktop-dependency";');
  try {
    await expect(bundleEntry(entry, root, join(root, "out"))).rejects.toThrow("missing-desktop-dependency");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("concurrent bundles of one entry resolve to the same finished bundle", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-shared-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export default { marker: "shared-bundle" };');
  try {
    // Read the bundle the moment each call resolves: a call that resolves before the build
    // finishes sees a missing or partial file.
    const results = await Promise.all(
      Array.from({ length: 4 }, async () => {
        const bundlePath = await bundleEntry(entry, root, join(root, "out"));
        return { bundlePath, contents: readFileSync(bundlePath, "utf8") };
      }),
    );

    const finalContents = readFileSync(results[0].bundlePath, "utf8");
    expect(finalContents).toContain("shared-bundle");
    for (const result of results)
      expect(result).toEqual({ bundlePath: results[0].bundlePath, contents: finalContents });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("retries an unchanged source when its bundle output becomes writable", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-output-repair-"));
  const entry = join(root, "extension.ts");
  const outDir = join(root, "out");
  writeFileSync(entry, "export default () => 42;");
  writeFileSync(outDir, "An existing file blocks the output directory.");
  try {
    let failure: unknown;
    try {
      await bundleEntry(entry, root, outDir);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    rmSync(outDir);

    const bundlePath = await bundleEntry(entry, root, outDir);
    const loaded = await import(bundlePath);
    expect(loaded.default()).toBe(42);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a load waits for a pending build even when its output is already visible", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-visible-"));
  const entry = join(root, "extension.ts");
  const outDir = join(root, "out");
  writeFileSync(entry, 'export default { marker: "finished-bundle" };');
  const originalBuild = Bun.build;
  const outputReady = Promise.withResolvers<void>();
  const finishBuild = Promise.withResolvers<void>();
  const build = spyOn(Bun, "build").mockImplementation(async (options) => {
    const result = await originalBuild(options);
    outputReady.resolve();
    await finishBuild.promise;
    return result;
  });
  let first: Promise<string> | undefined;
  let second: Promise<string> | undefined;
  try {
    first = bundleEntry(entry, root, outDir);
    await outputReady.promise;
    let loaded = false;
    second = bundleEntry(entry, root, outDir).then((path) => {
      loaded = true;
      return path;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(loaded).toBe(false);
    finishBuild.resolve();
    const paths = await Promise.all([first, second]);
    expect(paths[0]).toBe(paths[1]);
    expect(readFileSync(paths[0], "utf8")).toContain("finished-bundle");
  } finally {
    finishBuild.resolve();
    await Promise.allSettled([first, second]);
    build.mockRestore();
    rmSync(root, { recursive: true, force: true });
  }
});

test("extension commands can import a public package with incidental CSS", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-css-"));
  const entry = join(root, "extension.ts");
  writeFileSync(join(root, "style.css"), ".example { color: red; }");
  writeFileSync(join(root, "helper.ts"), 'import "./style.css"; export const next = (value: number) => value + 1;');
  writeFileSync(entry, 'import { next } from "./helper"; export default { run: () => next(41) };');
  try {
    const bundlePath = await bundleEntry(entry, root, join(root, "out"));
    const loaded = await import(bundlePath);
    expect(loaded.default.run()).toBe(42);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a prepared copy imports dependencies that find their own file through __filename", async () => {
  const snapshotRoot = mkdtempSync(join(tmpdir(), "extension-bundle-snapshot-"));
  // Prepared revisions nest the package below the snapshot root.
  const packagePath = join(snapshotRoot, "fs", "2f", "staging", "harness");
  const dependency = join(packagePath, "node_modules", "runtime-artifacts");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(join(dependency, "package.json"), '{"name":"runtime-artifacts","type":"module","main":"index.js"}');
  writeFileSync(
    join(dependency, "index.js"),
    [
      'import { createRequire } from "node:module";',
      'const require2 = createRequire(typeof __filename === "string" ? __filename : import.meta.url);',
      'export const dependencyFile = [typeof require2.resolve, typeof __filename === "string" ? __filename : ""];',
    ].join("\n"),
  );
  const entry = join(packagePath, "extension.ts");
  writeFileSync(
    entry,
    [
      'import { dependencyFile } from "runtime-artifacts";',
      'const ownFile = typeof __filename === "string" ? __filename : import.meta.url;',
      "export default { dependencyFile, ownFile };",
    ].join("\n"),
  );
  try {
    const bundlePath = await bundleEntry(entry, packagePath, join(snapshotRoot, "out"), snapshotRoot);
    const loaded = await import(bundlePath);
    // Each file keeps its own location, so a dependency can find files next to it.
    expect(loaded.default).toEqual({ dependencyFile: ["function", join(dependency, "index.js")], ownFile: entry });
  } finally {
    rmSync(snapshotRoot, { recursive: true, force: true });
  }
});
