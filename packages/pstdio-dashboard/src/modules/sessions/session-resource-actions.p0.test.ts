import { expect, test } from "bun:test";
import { sessionBrowser } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { createSessionsModule } from "./module";
import { registerSessionProvider } from "./session-provider.fixture";

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

test("synced removal preserves another provider page and archive clears only the affected session route", () => {
  const workbench = setup();
  registerSessionProvider(workbench, { projectId: "actions-project" });
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
  expect(workbench.pages.store.getState().location?.page).toEqual(sessionBrowser.pages.compose);
  expect(workbench.pages.store.getState().location?.resource).toBeUndefined();
  workbench.dispose();
});

test("a pending public fork keeps its session/reply and cannot replace another project's navigation", async () => {
  let release!: () => void;
  let entered!: () => void;
  const requested = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  const workbench = setup();
  const calls: unknown[] = [];
  registerSessionProvider(workbench, {
    projectId: "actions-project",
    sessions: {
      fork: async (id, messageId) => {
        calls.push({ id, messageId });
        entered();
        await response;
        return { id: "copied-session", title: "A (fork)", status: "completed" } as never;
      },
    },
  });
  try {
    openSessionsPage(workbench, { type: "session", id: "b" });
    const pending = workbench.commands.executeCommand(
      dashboardCommandIds.forkSession,
      { sessionId: "a", messageId: "earlier-answer" },
      { resource: { type: "session", id: "b" } },
    );
    await requested;
    expect(calls).toEqual([{ id: "a", messageId: "earlier-answer" }]);
    selectDashboardProject(workbench, { id: "other-project", name: "Other" });
    openSessionsPage(workbench);
    const location = workbench.pages.store.getState().location;
    release();
    await pending;
    expect(workbench.pages.store.getState().location).toEqual(location);
  } finally {
    release();
    workbench.dispose();
  }
});
