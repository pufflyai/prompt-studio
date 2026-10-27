import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { type BundledExtensionSources, packExtensionSource } from "pstdio-extensions/distribution";
import { prepareBundledExtensionSource } from "./bundled-extension-source";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("prepares bundled extension sources with their lockfile and commit without Git", async () => {
  const root = mkdtempSync(join(tmpdir(), "bundled-extension-source-"));
  roots.push(root);
  const source = join(root, "source");
  mkdirSync(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "demo",
      publisher: "test",
      version: "1.0.0",
      main: "extension.ts",
      files: ["extension.ts"],
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(source, "extension.ts"), "export default {};");
  writeFileSync(join(source, "bun.lock"), "locked dependency inputs");
  const packed = await packExtensionSource(source);
  const origin = { url: "https://github.com/example/extensions", path: "extensions/demo" };
  const manifest: BundledExtensionSources = {
    ref: "release",
    commit: "a".repeat(40),
    sources: [
      {
        ...origin,
        installName: "demo",
        id: packed.manifest.id,
        version: packed.manifest.version,
        sha256: packed.sha256,
      },
    ],
  };
  const files = [
    new File([JSON.stringify(manifest)], "extension-sources/manifest.json"),
    new File([packed.bytes], "extension-sources/demo.tgz"),
  ];
  const prepared = await prepareBundledExtensionSource(origin, root, "release", { files });
  expect(prepared?.commit).toBe(manifest.commit);
  expect(readFileSync(join(prepared!.path, "bun.lock"), "utf8")).toBe("locked dependency inputs");
  expect(
    await prepareBundledExtensionSource({ ...origin, url: "https://example.com/other" }, root, "release", { files }),
  ).toBeNull();
  expect(await prepareBundledExtensionSource(origin, root, "development", { files })).toBeNull();
  const controller = new AbortController();
  controller.abort();
  await expect(
    prepareBundledExtensionSource(origin, root, "release", { files, signal: controller.signal }),
  ).rejects.toThrow();
});
