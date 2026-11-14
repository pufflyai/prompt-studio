import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncExtensionLockfile } from "./sync-extension-lockfiles";

test("renaming an extension refreshes its standalone lock identity without changing resolved dependencies", () => {
  const root = mkdtempSync(join(tmpdir(), "extension-lock-identity-"));
  const dir = "extensions/example";
  const source = join(root, dir);
  const manifest = { name: "historical-name", dependencies: { "@types/bun": "1.4.4" } };
  const readLock = () => JSON.parse(readFileSync(join(source, "bun.lock"), "utf8").replace(/,\s*([}\]])/g, "$1"));
  try {
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
    const setup = Bun.spawnSync(["bun", "install", "--lockfile-only", "--ignore-scripts"], { cwd: source });
    if (setup.exitCode !== 0) throw new Error(new TextDecoder().decode(setup.stderr));
    const previous = readLock();
    expect(previous.workspaces[""].name).toBe(manifest.name);
    writeFileSync(join(source, "package.json"), JSON.stringify({ ...manifest, name: "canonical-name" }));
    syncExtensionLockfile(dir, root);
    const updated = readLock();
    expect(updated.workspaces[""].name).toBe("canonical-name");
    expect(updated.workspaces[""].dependencies).toEqual(previous.workspaces[""].dependencies);
    expect(updated.packages).toEqual(previous.packages);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
