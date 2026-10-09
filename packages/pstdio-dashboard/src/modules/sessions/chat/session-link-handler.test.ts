import { expect, test } from "bun:test";
import { parsePageUrl, workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { getCollection, getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionLinkHandler } from "./session-link-handler";

test("chat paths use the session workspace while another workspace is selected", async () => {
  getCollection("workspaces");
  const writer = getWriter("workspaces")!;
  const projectId = "chat-link-project";
  for (const id of ["workspace-a", "workspace-b"])
    writer.upsert({
      id,
      project_id: projectId,
      name: id,
      workspace_shorthand: id,
      root_path: `/repo/${id}`,
      execution_kind: "local",
      provider_state: "ready",
      provider_capabilities_json: { files: "write" },
    });
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: projectId, name: "Chat links" });
  workbench.pageLocations.setProject(projectId);
  workbench.pageLocations.navigate({
    kind: "page",
    page: workbenchPages.workspace,
    resource: { type: "workspace", id: "workspace-b" },
  });
  const errors: string[] = [];
  const handler = createSessionLinkHandler({
    workbench,
    projectId,
    workspaceId: "workspace-a",
    origin: "http://local",
    onError: (message) => errors.push(message),
  });
  const candidate = { source: "src/app.ts:12", origin: "markdown" as const };
  const href = handler.resolveHref(candidate)!;
  expect(parsePageUrl({ url: href, projectId, pages: workbench.pages.listPages() })?.resource).toMatchObject({
    id: "workspace-a",
    metadata: { workspaceFilePath: "src/app.ts" },
  });
  await handler.open(candidate);
  expect(workbench.pages.store.getState().location).toMatchObject({
    resource: { id: "workspace-a", metadata: { workspaceFilePath: "src/app.ts" } },
    position: { line: 12 },
  });
  const before = workbench.pages.store.getState().location;
  await handler.open({ source: "/repo/workspace-b/src/app.ts", origin: "tool" });
  expect(workbench.pages.store.getState().location).toBe(before);
  expect(errors).toHaveLength(1);
  await handler.open({ source: `http://local/projects/${projectId}/unknown`, origin: "markdown" });
  expect(workbench.pages.store.getState().location).toBe(before);
  expect(errors).toHaveLength(2);
  expect(
    handler.resolveHref({ source: "https://external.test/projects/other/workspace", origin: "markdown" }),
  ).toBeNull();
  selectDashboardProject(workbench, { id: "different-project", name: "Other" });
  await handler.open(candidate);
  expect(workbench.pages.store.getState().location).toBe(before);
  for (const id of ["workspace-a", "workspace-b"]) writer.remove(id);
});
