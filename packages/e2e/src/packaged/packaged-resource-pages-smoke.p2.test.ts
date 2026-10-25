import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { WORKSPACES_COLLECTION_ID } from "pstdio-api-contracts";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test(
  "packaged resource queries expose canonical fields and required nullable cursors",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-resource-pages-"));
    let child: ChildProcess | undefined;
    try {
      const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      child = runtime.child;
      const client = createClient({
        baseUrl: runtime.baseUrl,
        token: runtime.descriptor.token,
      });
      const folder = join(root, "project");
      mkdirSync(folder);
      const project = await client.projects.create({
        name: "Resource conventions",
        initialWorkspace: { providerId: "pstdio.root", params: { path: folder } },
      });
      expect(project.createdAt).toBe(project.created_at);
      expect(project.defaultAgentId).toBe(project.default_agent_id);
      const workspaces = await client.workspaces.query(project.id);
      expect(workspaces.nextCursor).toBeNull();
      expect(workspaces.items).toHaveLength(1);
      const workspace = workspaces.items[0]!;
      expect(workspace.projectId).toBe(project.id);
      expect(workspace.rootPath).toBe(realpathSync(folder));
      const pages = await Promise.all([
        client.projects.query(),
        client.sessions.query(project.id),
        client.skills.query(project.id),
        client.agents.query(project.id),
        client.workspaces.queryProviders(project.id),
        client.views.queryBoards(project.id),
        client.views.query(project.id, WORKSPACES_COLLECTION_ID),
        client.views.queryOrphaned(project.id),
        client.notifications.query(project.id),
        client.resources.queryAnchors(project.id, { resource: { type: "workspace", id: workspace.id } }),
      ]);
      for (const page of pages) {
        expect(Array.isArray(page.items)).toBe(true);
        expect(page.nextCursor).toBeNull();
      }
      expect((await client.views.queryBoards(project.id)).items.map((board) => board.id)).toContain(
        WORKSPACES_COLLECTION_ID,
      );
      const activity = await client.workspaces.listActivity(workspace.id, { eventType: "workspace.changed" });
      expect(activity.items).toEqual([]);
      expect(activity.nextCursor).toBeNull();
      expect(await client.filesystem.createDirectory({ parentPath: folder, name: "notes" })).toEqual({
        path: realpathSync(join(folder, "notes")),
      });
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
