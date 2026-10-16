import { afterEach, expect, test } from "bun:test";
import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { createWorkbenchTerminalModule, openWorkbenchTerminal } from "@pstdio/workbench/react";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { relatedTerminalResources } from "./terminal-related-resources";

afterEach(() => getWriter("workspaces")?.truncateAndWrite([]));
const setup = () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkbenchTerminalModule());
  selectDashboardProject(workbench, { id: "project", name: "Project" });
  getWriter("workspaces")?.truncateAndWrite([
    {
      id: "workspace",
      project_id: "project",
      name: "Workspace",
      root_path: "/repo",
      archived: false,
      is_default: true,
    },
  ]);
  const resource = { type: "workspace", id: "workspace", extensionId: "pstdio", projectId: "project" };
  return { workbench, resource, ctx: workbench as WorkbenchModuleContext };
};
test("a workspace offers a stable terminal preview with its effective directory", () => {
  const { ctx, resource } = setup();
  const [candidate] = relatedTerminalResources(ctx, resource);
  expect(candidate?.resource.metadata).toMatchObject({ workspaceId: "workspace", workspacePath: "/repo" });
  expect(candidate?.target.panel.kind).toBe("shell-placement");
  expect(relatedTerminalResources(ctx, resource)[0]?.resource.id).toBe(candidate?.resource.id);
  expect(relatedTerminalResources(ctx, { ...resource, projectId: "other" })).toEqual([]);
});
test("a workspace offers its last live terminal without making another terminal", () => {
  const { ctx, workbench, resource } = setup();
  const terminalResource = relatedTerminalResources(ctx, resource)[0]!.resource;
  openWorkbenchTerminal(ctx, { resource: terminalResource });
  const last = openWorkbenchTerminal(ctx, { resource: terminalResource });
  const related = relatedTerminalResources(ctx, resource);
  expect(related[0]?.resource.id).toBe(last.resource!.id);
  expect(workbench.layout.listPanelInstances("secondary")).toHaveLength(2);
});
