import { expect, test } from "bun:test";
import { createWorkbench, resourceContextMenuPath } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { createSessionsModule } from "./module";

const setup = () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "actions-project", name: "Actions" });
  getWriter("sessions")?.truncateAndWrite([
    { id: "a", project_id: "actions-project", title: "A", status: "completed", archived: false },
    { id: "b", project_id: "actions-project", title: "B", status: "completed", archived: false },
  ]);
  workbench.registerModule(createSessionsModule());
  return workbench;
};

test("session management belongs to Sessions and resolves explicit and row targets before active selection", async () => {
  const workbench = setup();
  const context = { resource: { type: "session", id: "b", label: "Stale B" } };
  expect(
    await workbench.commands.prepareCommandArgs(dashboardCommandIds.renameSession, undefined, context),
  ).toMatchObject({ sessionId: "b", title: "B" });
  expect(
    await workbench.commands.prepareCommandArgs(dashboardCommandIds.renameSession, { sessionId: "a" }, context),
  ).toMatchObject({ sessionId: "a", title: "A" });
  const menu = workbench.layout.listMenuItems(resourceContextMenuPath("session"));
  expect(menu.map((item) => item.commandId)).toEqual(
    expect.arrayContaining([
      dashboardCommandIds.renameSession,
      dashboardCommandIds.archiveSession,
      dashboardCommandIds.deleteSession,
    ]),
  );
  await workbench.commands.executeCommand(dashboardCommandIds.renameSession, undefined, context);
  expect(workbench.commandPalette.getParamsRequest()?.args).toMatchObject({ sessionId: "b", title: "B" });
  workbench.dispose();
});

test("synced removal preserves a different page and archive clears the affected session route", () => {
  const workbench = setup();
  openSessionsPage(workbench, { type: "session", id: "a" });
  expect(workbench.pages.store.getState().location?.resource).toMatchObject({
    id: "a",
    extensionId: "pstdio",
    projectId: "actions-project",
  });
  getWriter("sessions")?.remove("b");
  expect(workbench.pages.store.getState().location?.resource?.id).toBe("a");
  getWriter("sessions")?.upsert({
    id: "a",
    project_id: "actions-project",
    title: "A",
    status: "completed",
    archived: true,
  });
  expect(workbench.pages.store.getState().location?.page.id).toBe("session-composer");
  expect(workbench.pages.store.getState().location?.resource).toBeUndefined();
  workbench.dispose();
});

test("draft context never falls back to a saved session for management", async () => {
  const workbench = setup();
  await expect(
    workbench.commands.prepareCommandArgs(dashboardCommandIds.renameSession, undefined, {
      resource: { type: "session-draft", id: "draft" },
    }),
  ).rejects.toThrow("saved session");
  workbench.dispose();
});

test("each session state offers exactly one delete action with the lifecycle guard", () => {
  const workbench = setup();
  const actions = workbench.layout
    .listMenuItems(resourceContextMenuPath("session"))
    .filter((item) => item.commandId === dashboardCommandIds.deleteSession);
  for (const status of [
    "in_progress",
    "awaiting_input",
    "queued",
    "completed",
    "failed",
    "cancelled",
    "disconnected",
  ]) {
    workbench.context.set("workbench.resource.type", "session");
    workbench.context.set("workbench.resource.metadata.status", status);
    const matches = actions.filter((item) => workbench.context.matches(item.when));
    expect(matches).toHaveLength(1);
    expect(matches[0]?.readOnly === true).toBe(["in_progress", "awaiting_input", "queued"].includes(status));
  }
  workbench.dispose();
});
