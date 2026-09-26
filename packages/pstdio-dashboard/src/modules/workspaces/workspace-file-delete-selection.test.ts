import { afterEach, beforeEach, expect, test } from "bun:test";
import { createWorkbench, type ResourceRef } from "@pstdio/workbench";
import { dashboardQueryClient } from "@/lib/query-client";
import { selectDashboardProject } from "@/shared/app/project-context";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "./module";
import { deleteWorkspaceEntry } from "./workspace-file-contributions";
import { workspaceDeleteResource, workspaceFileResource } from "./workspace-file-resource";

const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
let server: ReturnType<typeof Bun.serve>;
beforeEach(() => {
  server = Bun.serve({ port: 0, fetch: () => new Response(null, { status: 204 }) });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.toString() };
});
afterEach(() => {
  server.stop(true);
  delete runtime.__PSTDIO_CONFIG__;
  dashboardQueryClient.clear();
});

test.each([
  true,
  false,
])("deleting from an older tree uses the current file selection (same workspace: %s)", async (sameWorkspace) => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  const root: ResourceRef = {
    type: "workspace",
    id: "workspace-1",
    label: "Workspace",
    metadata: { workspaceId: "workspace-1", workspaceProviderState: "ready", workspaceView: "files" },
  };
  const treeResource = workspaceFileResource(root, "before-rename.md");
  const currentRoot = sameWorkspace
    ? root
    : { ...root, id: "workspace-2", metadata: { ...root.metadata, workspaceId: "workspace-2" } };
  openWorkspacesPage(workbench, workspaceFileResource(currentRoot, "renamed.md"));
  await deleteWorkspaceEntry(workbench, workspaceDeleteResource(treeResource, "renamed.md", "file"));
  const selected = workbench.getPrimaryResource();
  expect(selected?.id).toBe(currentRoot.id);
  expect(selected?.metadata?.workspaceFilePath).toBe(sameWorkspace ? undefined : "renamed.md");
});
