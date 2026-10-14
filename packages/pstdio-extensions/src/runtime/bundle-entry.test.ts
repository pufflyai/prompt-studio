import { expect, spyOn, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleEntry } from "./bundle-entry";

test("reports the unresolved dependency when an extension cannot be bundled", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-error-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export { default } from "missing-desktop-dependency";');
  try {
    const error = await bundleEntry(entry, root, join(root, "out")).catch((error: unknown) => error);
    expect(error).toMatchObject({ message: expect.stringContaining("missing-desktop-dependency") });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("concurrent bundles of one entry share one build and resolve after it finishes", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-shared-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export default { marker: "shared-bundle" };');
  const build = spyOn(Bun, "build");
  try {
    // Read the bundle the moment each call resolves: a call that resolves before the build
    // finishes sees a missing or partial file.
    const results = await Promise.all(
      Array.from({ length: 4 }, async () => {
        const bundlePath = await bundleEntry(entry, root, join(root, "out"));
        return { bundlePath, contents: readFileSync(bundlePath, "utf8") };
      }),
    );

    expect(build).toHaveBeenCalledTimes(1);
    const finalContents = readFileSync(results[0].bundlePath, "utf8");
    expect(finalContents).toContain("shared-bundle");
    for (const result of results)
      expect(result).toEqual({ bundlePath: results[0].bundlePath, contents: finalContents });
  } finally {
    build.mockRestore();
    rmSync(root, { recursive: true, force: true });
  }
});

test("a later bundle retries after a failed build", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-retry-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export { default } from "./missing-module";');
  try {
    const error = await bundleEntry(entry, root, join(root, "out")).catch((error: unknown) => error);
    expect(error).toMatchObject({ message: expect.stringContaining("missing-module") });
    writeFileSync(join(root, "missing-module.ts"), 'export default { marker: "retried-bundle" };');

    const bundlePath = await bundleEntry(entry, root, join(root, "out"));

    expect(readFileSync(bundlePath, "utf8")).toContain("retried-bundle");
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
