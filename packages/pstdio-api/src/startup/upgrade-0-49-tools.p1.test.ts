import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashExtensionSource } from "../features/extensions/hash-extension-source";
import { upgrade049Tools } from "./upgrade-0-49-tools";

test("the 0.48 upgrade retries a managed incompatible source and preserves compatible, forked and edited tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-tool-upgrade-"));
  const oldHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  try {
    const dir = join(root, "extensions", "planner");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "extension.ts"), "export default {};");
    const base = {
      id: "managed",
      extension_id: "pstdio.planner",
      install_name: "planner",
      source_path: dir,
      source_hash: hashExtensionSource(dir),
      source_kind: "git",
      source_ref: `https://github.com/pufflyai/prompt-studio@${"a".repeat(40)}#extensions/pstdio-planner`,
      manifest_json: { enginesPstdio: "^0.5.0" },
    };
    const sources = new Map(
      [
        base,
        { ...base, id: "compatible", manifest_json: { enginesPstdio: "^0.6.0" } },
        { ...base, id: "local", source_kind: "local_path", source_ref: null },
        { ...base, id: "other", extension_id: "acme.planner" },
        { ...base, id: "fork", source_ref: base.source_ref.replace("pufflyai", "someone") },
        { ...base, id: "modified", source_hash: "edited" },
      ].map((s) => [s.id, s]),
    );
    let pending = true;
    const prefs = {
      get: async () => (pending ? { value: [...sources.keys(), "uninstalled"] } : null) as never,
      remove: async () => {
        pending = false;
        return true;
      },
    };
    const lookup = { get: async (id: string) => (sources.get(id) ?? null) as never };
    let failed = false;
    const updated: string[] = [];
    const service = {
      registry: undefined,
      releaseRef: "pstdio@0.49.0",
      upgradeInstalled: async (source: typeof base) => {
        updated.push(source.id);
        if (!failed) {
          failed = true;
          throw new Error("interrupted install");
        }
        return { installedSource: { ...source, manifest_json: { enginesPstdio: "^0.6.0" } } } as never;
      },
    };
    await expect(upgrade049Tools(prefs, lookup, service as never)).rejects.toThrow("interrupted install");
    expect(pending).toBe(true);
    await upgrade049Tools(prefs, lookup, service as never);
    expect(pending).toBe(false);
    await upgrade049Tools(prefs, lookup, service as never);
    expect(updated).toEqual(["managed", "managed"]);
  } finally {
    if (oldHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = oldHome;
    await rm(root, { recursive: true, force: true });
  }
});
