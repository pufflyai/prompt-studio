import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildExtensionWebview } from "./extension-webview-builder";
import { installExtensionSource } from "./install-extension-source";
import { writeExtension } from "./test-utils/webview-build-fixture";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("a failed webview activation preserves the previous extension and its working view", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-upgrade-activation-"));
  roots.push(root);
  const source = join(root, "source");
  const write = async (version: string) => {
    writeExtension(source, { main: "src/main.tsx" }, { version });
    const path = join(source, "extension.ts");
    await writeFile(
      path,
      (await readFile(path, "utf8")).replace('id: "main",', 'id: "main", ref: { kind: "view", id: "main" },'),
    );
  };
  await write("1.0.0");
  const options = { source, installName: "pstdio.lab", env: { PSTDIO_HOME: join(root, "home") }, skipInstall: true };
  const installed = await installExtensionSource(options);
  expect(
    (
      await buildExtensionWebview({
        entryPath: join(installed.targetPath, "src/main.tsx"),
        outdir: join(root, "previous-view"),
        signal: new AbortController().signal,
      })
    ).success,
  ).toBe(true);
  const previous = await readFile(join(installed.targetPath, "src/main.tsx"), "utf8");
  await write("1.0.1");
  await writeFile(join(source, "src/main.tsx"), "const = ;");
  await expect(installExtensionSource({ ...options, force: true })).rejects.toThrow("webview");
  expect(JSON.parse(await readFile(join(installed.targetPath, "package.json"), "utf8")).version).toBe("1.0.0");
  expect(await readFile(join(installed.targetPath, "src/main.tsx"), "utf8")).toBe(previous);
});
