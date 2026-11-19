import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createDb } from "../../db/connection.pglite";
import { createInstalledExtensionSourcesDBService } from "./installed-extension-sources";

let close: (() => Promise<void>) | undefined;
let svc: ReturnType<typeof createInstalledExtensionSourcesDBService>;

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  svc = createInstalledExtensionSourcesDBService(result.db);
});

afterEach(async () => {
  try {
    await close?.();
  } finally {
    // Hooks recreate these owners; release closed engines between cases and files.
    close = undefined!;
    svc = undefined!;
  }
});

test("conditionally records load state only while the source registration is unchanged", async () => {
  const original = await svc.register({
    install_name: "lab",
    extension_id: "pstdio.lab",
    display_name: "Lab",
    source_kind: "local_path",
    source_path: "/extensions/lab",
    source_hash: "hash-1",
  });
  const current = await svc.updateRegistration(original.id, { source_hash: "hash-2", status: "loaded" });
  const obsolete = await svc.updateLoadStateIfUnchanged(original.id, original.updated_at, { status: "error" });
  expect(obsolete).toBeNull();
  expect(await svc.get(original.id)).toMatchObject({ source_hash: "hash-2", status: "loaded" });
  const recorded = await svc.updateLoadStateIfUnchanged(original.id, current!.updated_at, { status: "error" });
  expect(recorded).toMatchObject({ source_hash: "hash-2", status: "error" });
});

describe("installedExtensionSourcesService", () => {
  test("registers and retrieves a source by install name", async () => {
    const registered = await svc.register({
      install_name: "pstdio.core-templates",
      extension_id: "pstdio.core-templates",
      display_name: "Core Templates",
      version: "0.1.0",
      source_kind: "local_path",
      source_path: "/builtin/pstdio.core-templates",
    });

    expect(registered.install_name).toBe("pstdio.core-templates");

    const fetched = await svc.getByInstallName("pstdio.core-templates");
    expect(fetched?.id).toBe(registered.id);
    expect(fetched?.status).toBe("pending");
  });

  test("allows duplicate install names when source paths differ", async () => {
    const first = await svc.register({
      install_name: "worktree-bootstrap",
      extension_id: "pstdio.worktree-bootstrap",
      display_name: "Worktree Bootstrap",
      source_kind: "local_path",
      source_path: "/repo-a/.pstdio/extensions/worktree-bootstrap",
    });

    const second = await svc.register({
      install_name: "worktree-bootstrap",
      extension_id: "pstdio.worktree-bootstrap",
      display_name: "Worktree Bootstrap",
      source_kind: "local_path",
      source_path: "/repo-b/.pstdio/extensions/worktree-bootstrap",
    });

    expect(second.id).not.toBe(first.id);
    await expect(
      svc.register({
        install_name: "worktree-bootstrap-copy",
        extension_id: "pstdio.worktree-bootstrap",
        display_name: "Worktree Bootstrap",
        source_kind: "local_path",
        source_path: first.source_path,
      }),
    ).rejects.toThrow();
  });

  test("retrieves sources by source path and prefix", async () => {
    const repoRoot = join("/repo", ".pstdio", "extensions");
    const first = await svc.register({
      install_name: "planner",
      extension_id: "pstdio.planner",
      display_name: "Planner",
      source_kind: "local_path",
      source_path: join(repoRoot, "planner"),
    });
    await svc.register({
      install_name: "other",
      extension_id: "pstdio.other",
      display_name: "Other",
      source_kind: "local_path",
      source_path: "/other-root/other",
    });

    const byPath = await svc.getBySourcePath(first.source_path);
    const byPrefix = await svc.listBySourcePathPrefix(repoRoot);

    expect(byPath?.id).toBe(first.id);
    expect(byPrefix.map((source) => source.id)).toEqual([first.id]);
  });

  test("updates load state", async () => {
    const registered = await svc.register({
      install_name: "pstdio.core-skills",
      extension_id: "pstdio.core-skills",
      display_name: "Core Skills",
      source_kind: "local_path",
      source_path: "/builtin/pstdio.core-skills",
    });

    const updated = await svc.updateLoadState(registered.id, {
      status: "loaded",
      source_hash: "hash-1",
      loaded_revision: "rev-1",
      last_loaded_at: new Date().toISOString(),
    });

    expect(updated?.status).toBe("loaded");
    expect(updated?.source_hash).toBe("hash-1");
  });

  test("updates source registration metadata", async () => {
    const registered = await svc.register({
      install_name: "planner",
      extension_id: "pstdio.planner",
      display_name: "Planner",
      source_kind: "local_path",
      source_path: "/one",
    });

    const updated = await svc.updateRegistration(registered.id, {
      display_name: "Planner 2",
      manifest_json: { version: "2.0.0" },
      source_hash: "hash-2",
      source_path: "/two",
      status: "loaded",
      version: "2.0.0",
    });

    expect(updated?.display_name).toBe("Planner 2");
    expect(updated?.source_path).toBe("/two");
    expect(updated?.source_hash).toBe("hash-2");
    expect(updated?.manifest_json).toEqual({ version: "2.0.0" });
  });
});
