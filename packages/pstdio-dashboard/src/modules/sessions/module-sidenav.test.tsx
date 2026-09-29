import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { treeViewBody, treeViewSections } from "@/shared/workbench/workbench-view-test-helpers";
import { createSidenavModule } from "../sidenav/module";
import { createSessionsModule } from "./module";

test("shows existing sessions immediately on the sessions aggregate", async () => {
  getWriter("sessions")?.truncateAndWrite([
    {
      id: "session-existing",
      project_id: "project-1",
      title: "Existing session",
      status: "completed",
      agent: null,
      last_selected_model: null,
      archived: false,
      created_at: "2026-06-02T10:00:00Z",
      updated_at: "2026-06-02T10:00:00Z",
      deleted_at: null,
    },
  ]);
  const workbench = createWorkbench();

  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  workbench.registerModule(createSidenavModule());
  workbench.registerModule(createSessionsModule());

  openSessionsPage(workbench);

  const sessionRows = (await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav))
    .flatMap((section) => section.nodes)
    .find((node) => node.id === "workspace-sessions")?.children;

  expect(sessionRows?.filter((node) => node.resource || node.target).map((node) => node.label)).toEqual([
    "Existing session",
  ]);
});

test("session navigation keeps its data scope while resource-dependent contributions still change scope", () => {
  const workbench = createWorkbench();
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  workbench.registerModule(createSidenavModule());
  workbench.registerModule(createSessionsModule());
  const open = (id: string) => openSessionsPage(workbench, { type: "session", id });
  const readKey = () => treeViewBody(workbench, dashboardWidgetIds.dashboardSidenav).getReadKey?.({});
  open("first");
  const firstKey = readKey();
  expect(firstKey).toBeDefined();
  open("second");
  expect(readKey()).toBe(firstKey);

  workbench.navigationTrees.registerContribution({
    id: "extension.session-actions",
    owner: { kind: "mode", id: "sessions", extensionId: "pstdio" },
    sourceExtensionId: "extension",
    declarationIndex: 0,
    getSections: () => [],
  });
  const dependentKey = readKey();
  open("first");
  expect(readKey()).not.toBe(dependentKey);
});
