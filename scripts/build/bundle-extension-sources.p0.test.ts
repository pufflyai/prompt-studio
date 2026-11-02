import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unpackExtension } from "pstdio-extensions/distribution";
import { bundleExtensionSources } from "./bundle-extension-sources";

test("retains packaged recovery sources for existing Remote Workspaces installations", async () => {
  const root = mkdtempSync(join(tmpdir(), "bundle-retained-extension-source-"));
  const write = (path: string, value: unknown) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), typeof value === "string" ? value : JSON.stringify(value));
  };
  try {
    const catalog = JSON.parse(readFileSync(join(import.meta.dir, "../../packages/pstdio-api/files/extension-catalog.json"), "utf8"));
    write("package.json", { repository: { url: "https://github.com/pufflyai/prompt-studio" } });
    write("packages/pstdio/package.json", { version: "1.0.0" });
    write("packages/pstdio-api/files/extension-catalog.json", {
      extensions: catalog.extensions.filter((entry: { installName: string }) => entry.installName === "remote-workspaces"),
    });
    write("extensions/remote-workspaces/package.json", {
      publisher: "pstdio", name: "remote-workspaces", version: "1.0.0", main: "extension.ts",
      files: ["extension.ts"], engines: { pstdio: "^0.3.0" },
    });
    write("extensions/remote-workspaces/extension.ts", "export default {};");
    for (const args of [["init", "-q"], ["add", "."], ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "Source"]]) {
      expect(Bun.spawnSync(["git", ...args], { cwd: root }).exitCode).toBe(0);
    }
    const bundled = await bundleExtensionSources(root);
    expect(bundled.sources).toContainEqual(expect.objectContaining({ installName: "remote-workspaces", id: "pstdio.remote-workspaces" }));
    const archive = readFileSync(join(root, "packages/pstdio/files/extension-sources/remote-workspaces.tgz"));
    const installed = join(root, "installed");
    await unpackExtension(archive, installed, bundled.sources[0]);
    expect(JSON.parse(readFileSync(join(installed, "package.json"), "utf8"))).toMatchObject({ publisher: "pstdio", name: "remote-workspaces" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test.each(["1.0.0", "0.46.0-nightly.20261028030226"])("bundles host catalog sources at %s with reproducible content and locked dependencies", async (version) => {
  const root = mkdtempSync(join(tmpdir(), "bundle-extension-sources-"));
  const write = (path: string, text: string) => { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), text); };
  try {
    write("package.json", JSON.stringify({ repository: { url: "https://example.com/repository.git" } }));
    write("packages/pstdio/package.json", JSON.stringify({ version }));
    write("packages/pstdio-api/files/extension-catalog.json", JSON.stringify({ extensions: [
      { installName: "demo", origin: { url: "https://example.com/repository", path: "extensions/demo", ref: "{hostRelease}" } },
      { installName: "external", origin: { url: "https://example.com/third-party", path: "not-shipped", ref: "main" } },
      { installName: "download", bundleSource: false, origin: { url: "https://example.com/repository", path: "not-shipped", ref: "{hostRelease}" } },
    ] }));
    write("extensions/demo/package.json", JSON.stringify({ publisher: "test", name: "demo", version, main: "extension.ts", files: ["extension.ts"], engines: { pstdio: "^0.3.0" } }));
    write("extensions/demo/extension.ts", "export default {};");
    write("extensions/demo/bun.lock", "locked dependency inputs");
    for (const args of [["init", "-q"], ["add", "."], ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "Source"]]) {
      const git = Bun.spawnSync(["git", ...args], { cwd: root });
      expect(git.exitCode, git.stderr.toString()).toBe(0);
    }
    const first = await bundleExtensionSources(root);
    const archive = join(root, "packages/pstdio/files/extension-sources/demo.tgz");
    const bytes = readFileSync(archive);
    const second = await bundleExtensionSources(root);
    expect(first).toEqual(second);
    expect(readFileSync(archive)).toEqual(bytes);
    expect(first.sources).toHaveLength(1);
    expect(first.sources[0]?.version).toBe(version);
    const target = join(root, "installed");
    await unpackExtension(bytes, target, first.sources[0]);
    expect(JSON.parse(readFileSync(join(target, "package.json"), "utf8")).version).toBe(version);
    expect(readFileSync(join(target, "bun.lock"), "utf8")).toBe("locked dependency inputs");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
