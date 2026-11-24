import { expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import { createProjectsDBService } from "../services/projects/projects";
import { resourceLinkQuery } from "../services/resource-link-rows";
import { createSessionsDBService } from "../services/sessions/sessions";
import { createWorkspaceSessionsDBService } from "../services/workspace-sessions/workspace-sessions";
import { createWorkspacesDBService } from "../services/workspaces/workspaces";
import { createDb } from "./connection.pglite";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";
import { prepareProjectExtensionsUpgrade } from "./project-extensions-upgrade";
import { prepareResourceLinkOwnerUpgrade } from "./resource-link-owner-upgrade";
import { resource_links, sessions } from "./schemas.pg";
import { prepareSessionWorkspaceUpgrade } from "./session-workspace-upgrade";

for (const interruption of ["normal", "schema", "partial"])
  test(`released session workspaces and historical context survive ${interruption}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "session-workspace-upgrade-"));
    const path = join(root, "database");
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      store = await createDb({ path });
      const project = await createProjectsDBService(store.db).create({ name: "Released workspace links" });
      const workspaces = createWorkspacesDBService(store.db);
      const first = await workspaces.create({ project_id: project.id, shorthand_base: "FIRST" });
      const second = await workspaces.create({ project_id: project.id, shorthand_base: "SECOND" });
      const third = await workspaces.create({ project_id: project.id, shorthand_base: "THIRD" });
      const stamp = "2026-11-20T00:00:00.000Z";
      await store.db.insert(sessions).values(
        Array.from({ length: 201 }, (_, index) => ({
          id: `session-${String(index).padStart(3, "0")}`,
          project_id: project.id,
          title: `Session ${index}`,
          status: "completed" as const,
          created_at: stamp,
          updated_at: stamp,
        })),
      );
      const originalSession = await createSessionsDBService(store.db).get("session-200");
      const savedContext = {
        project_id: project.id,
        source_owner: "pstdio",
        source_kind: "session",
        source_id: "session-000",
        target_owner: "pstdio",
        target_kind: "workspace",
        target_id: second.id,
        role: "context" as const,
        details: { type: "workspace", id: second.id, label: "My saved context", shorthand: "Custom" },
      };
      const coreId = await ensureStorageOwner(store.db, { workbenchId: project.id, extensionId: "pstdio" });
      const targetId = await ensureStorageOwner(store.db, { workbenchId: project.id, extensionId: "example" });
      const { project_id: _project, ...savedFields } = savedContext;
      await store.db.insert(resource_links).values([
        { ...savedFields, source_owner: coreId, target_owner: coreId },
        {
          source_owner: coreId,
          source_kind: "workspace",
          source_id: second.id,
          target_owner: targetId,
          target_kind: "ticket",
          target_id: "ticket",
          role: "context",
          details: { type: "ticket", id: "ticket" },
        },
      ]);
      await restoreReleasedPreferenceTables(store);
      await store.pglite.query(
        "INSERT INTO workspace_sessions SELECT 'primary-' || id, $1, id, $2 FROM sessions WHERE project_id = $3",
        [first.id, stamp, project.id],
      );
      await store.pglite.query(
        "INSERT INTO workspace_sessions VALUES ('extra-b',$1,'session-000','2026-11-21T00:00:00.000Z'), ('extra-c',$2,'session-000','2026-11-22T00:00:00.000Z')",
        [second.id, third.id],
      );
      const originalLinks = (
        await store.pglite.query("SELECT * FROM workspace_sessions ORDER BY session_id, created_at, id")
      ).rows;
      if (interruption !== "normal") {
        await prepareSessionWorkspaceUpgrade(store.db, path);
        await prepareResourceLinkOwnerUpgrade(store.db, path);
        await prepareProjectExtensionsUpgrade(store.db, store.path);
        await migrate(store.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
        if (interruption === "partial")
          await store.db.update(sessions).set({ workspace_id: first.id }).where(eq(sessions.id, "session-000"));
      }
      await store.close();
      store = await createDb({ path });
      const links = createWorkspaceSessionsDBService(store.db);
      const sessionService = createSessionsDBService(store.db);
      expect((await links.getWorkspaceBySessionId("session-000"))?.id).toBe(first.id);
      expect(await links.listByWorkspace(first.id)).toHaveLength(201);
      expect(await links.listByWorkspace(second.id)).toEqual([]);
      expect(await sessionService.get("session-200")).toEqual(originalSession);
      expect(await links.listSessionLinks("session-000")).toEqual([
        { id: "session-000", session_id: "session-000", workspace_id: first.id, created_at: stamp },
      ]);
      expect(await resourceLinkQuery(store.db).where(eq(resource_links.source_id, "session-000"))).toContainEqual(
        savedContext,
      );
      const context = await sessionService.query(project.id, {
        anchor: { projectId: project.id, extensionId: "example", type: "ticket", id: "ticket" },
        includeWorkspaceAnchors: true,
      });
      expect(context.rows.map((row) => row.id)).toEqual(["session-000"]);
      const archive = `${path}-migration-exports/workspace-sessions.jsonl`;
      const exported = (await Bun.file(archive).text())
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(exported).toEqual(originalLinks);
      const mtime = (await stat(archive)).mtimeMs;
      const count = (await store.db.select().from(resource_links)).length;
      await store.close();
      store = await createDb({ path });
      expect((await createWorkspaceSessionsDBService(store.db).getWorkspaceBySessionId("session-000"))?.id).toBe(
        first.id,
      );
      expect((await store.db.select().from(resource_links)).length).toBe(count);
      expect((await stat(archive)).mtimeMs).toBe(mtime);
    } finally {
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
