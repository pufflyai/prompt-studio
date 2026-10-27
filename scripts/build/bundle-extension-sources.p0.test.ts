import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unpackExtension } from "pstdio-extensions/distribution";
import { bundleExtensionSources } from "./bundle-extension-sources";

test("bundles host catalog sources with reproducible content and locked dependencies", async () => {
  const root = mkdtempSync(join(tmpdir(), "bundle-extension-sources-"));
  const write = (path: string, text: string) => { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), text); };
  try {
    write("package.json", JSON.stringify({ repository: { url: "https://example.com/repository.git" } }));
    write("packages/pstdio/package.json", JSON.stringify({ version: "1.0.0" }));
    write("packages/pstdio-api/files/extension-catalog.json", JSON.stringify({ extensions: [
      { installName: "demo", origin: { url: "https://example.com/repository", path: "extensions/demo", ref: "{hostRelease}" } },
      { installName: "external", origin: { url: "https://example.com/third-party", path: "not-shipped", ref: "main" } },
    ] }));
    write("extensions/demo/package.json", JSON.stringify({ publisher: "test", name: "demo", version: "1.0.0", main: "extension.ts", files: ["extension.ts"], engines: { pstdio: "^0.3.0" } }));
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
    const target = join(root, "installed");
    await unpackExtension(bytes, target, first.sources[0]);
    expect(readFileSync(join(target, "bun.lock"), "utf8")).toBe("locked dependency inputs");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
