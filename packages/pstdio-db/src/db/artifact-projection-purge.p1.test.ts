import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { projectExtensionId } from "../services/extension-instances/project-extension-row";
import { createArtifactFileProjectionsDBService } from "../services/extension-storage/artifact-file-projections";
import { createExtensionUserDataDBService } from "../services/extension-user-data/extension-user-data";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";

test("explicitly purging a migrated artifact owner allows a fresh mirror after reopen while unknown roots remain blocked", async () => {
  const root = await mkdtemp(join(tmpdir(), "artifact-purge-review-"));
  const prior = await createTextLogOwnerFixture(root);
  let priorClosed = false;
  let store: Awaited<ReturnType<typeof createDb>> | undefined;
  const owner = { workbenchId: "project", extensionId: "review.artifacts" };
  const key = (path: string) =>
    createHash("sha256")
      .update(JSON.stringify([owner, resolve(path, ".pstdio/extension-storage", owner.extensionId)]))
      .digest("hex");
  try {
    await prior.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at) VALUES('project','P','P','2026-11-22','2026-11-22');
   INSERT INTO extensions(id,install_name,extension_id,display_name,source_kind,source_path,created_at,updated_at) VALUES('source','artifacts','review.artifacts','Artifacts','local_path','/extension','2026-11-22','2026-11-22');
   INSERT INTO project_extensions(project_id,extension_ref,created_at,updated_at) VALUES('project','source','2026-11-22','2026-11-22');
   INSERT INTO workspaces(id,project_id,name,root_path,workspace_shorthand,execution_kind,created_at,updated_at) VALUES('workspace','project','W','/known','WS-1','local','2026-11-22','2026-11-22');`);
    for (const path of ["/known", "/unknown"]) {
      await prior.pglite.query("INSERT INTO artifact_file_projection_roots VALUES($1)", [key(path)]);
      await prior.pglite.query("INSERT INTO artifact_file_projections VALUES($1,$2,$3)", [
        key(path),
        "note.md",
        JSON.stringify({ node: null, hash: null, revision: "original 日本語" }),
      ]);
    }
    await prior.close();
    priorClosed = true;
    store = await createDb({ path: prior.path });
    const api = () => createArtifactFileProjectionsDBService(store!.db);
    expect((await api().open(key("/known"), owner).read()).initialized).toBe(true);
    await expect(api().open(key("/unknown"), owner).read()).rejects.toThrow("retained");
    const archive = await readFile(`${prior.path}-migration-exports/artifact_file_projection_roots.jsonl`);
    await createExtensionUserDataDBService(store!.db).deleteForInstance(projectExtensionId("project", "source"));
    expect((await api().open(key("/known"), owner).read()).initialized).toBe(false);
    await store.close();
    store = await createDb({ path: prior.path });
    expect(await readFile(`${prior.path}-migration-exports/artifact_file_projection_roots.jsonl`)).toEqual(archive);
    await expect(api().open(key("/unknown"), owner).read()).rejects.toThrow("retained");
    // Explicit data deletion is intentional, not a failed/missing owner conversion.
    expect(await api().open(key("/known"), owner).initialize({})).toBe(true);
    expect(await api().open(key("/known"), owner).read()).toEqual({ initialized: true, state: {} });
    console.log(
      JSON.stringify({ purgedRootCanInitializeAfterReopen: true, unknownStillBlocked: true, archiveUnmodified: true }),
    );
  } finally {
    if (!priorClosed) await prior.close();
    await store?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);
