import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardSessionResource } from "@/shared/app/resources";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionsModule } from "../module";
import { registerSessionProvider } from "../session-provider.fixture";

test("session picker exposes the complete project source and navigates the invoking page", async () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionsModule());
  selectDashboardProject(workbench, { id: "picker-project", name: "Picker" });
  const sessions = Array.from({ length: 65 }, (_, index) => ({
    id: `picker-${index}`,
    title: `History ${index}`,
    status: "completed",
  }));
  const queries: unknown[] = [];
  registerSessionProvider(workbench, {
    projectId: "picker-project",
    sessions: {
      query: async (input) => {
        queries.push(input);
        const offset = Number(input?.cursor ?? 0);
        const limit = input?.limit ?? 50;
        return {
          items: sessions.slice(offset, offset + limit) as never,
          nextCursor: offset + limit < sessions.length ? String(offset + limit) : null,
        };
      },
      get: async (id) => sessions.find((session) => session.id === id) as never,
    },
  });
  try {
    openSessionsPage(workbench, createDashboardSessionResource("picker-0", "History 0", "picker-project"));
    const main = workbench.pages.getContent()!;
    const groups = await workbench.commandPaletteResources.queryProviders({
      query: "",
      limit: 100,
      resourceType: "session",
    });
    const entries = groups.flatMap((group) => group.results);
    expect(entries).toHaveLength(65);
    expect(queries).toEqual([{ limit: 100, orderBy: "lastActivity", search: undefined }]);
    const entry = entries.find((entry) => entry.resource?.id === "picker-64")!;
    await workbench.commands.executeCommand(dashboardCommandIds.switchSession, {
      sessionId: entry.resource!.id,
      placementIdentity: main.placementIdentity,
      from: main.resource,
    });
    expect(workbench.getPrimaryResource()?.id).toBe("picker-64");
    expect(workbench.layout.listPanelInstances("side")).toHaveLength(0);
  } finally {
    workbench.dispose();
  }
});
