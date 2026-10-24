import { expect, test } from "bun:test";
import { workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchPanelRegion } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardSessionResource } from "@/shared/app/resources";
import { navigateDashboardPage, openSessionsPage } from "@/shared/workbench/page-navigation";
import { createStartModule } from "../../start/module";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionsModule } from "../module";
import { openCreatedSessionFromDraft } from "./session-chat-actions";
import type { SessionViewContext } from "./session-view-context";

const draft = { type: "session-draft", id: "draft", extensionId: "pstdio", projectId: "project-1" };
const fixture = () => {
  const w = createWorkbench();
  w.registerModule(createWorkspacesModule());
  w.registerModule(createStartModule());
  w.registerModule(createSessionsModule());
  selectDashboardProject(w, { id: "project-1", name: "Project" });
  openSessionsPage(w);
  return w;
};
const context = (workbench: ReturnType<typeof fixture>, region: WorkbenchPanelRegion = "main"): SessionViewContext => {
  const content = region === "main" ? workbench.pages.getContent() : undefined;
  const instance = content
    ? { ...content, instanceId: content.widgetId, panelId: content.contributionId, closable: false }
    : workbench.layout.getActivePanel(region)!;
  return { workbench, region, instance, changeViewer: workbench.viewers.capture(instance.placementIdentity!) };
};
const complete = (input: SessionViewContext) =>
  openCreatedSessionFromDraft({
    input,
    sessionId: "created",
    prompt: "Build the tool",
    projectId: "project-1",
  });

for (const resource of [undefined, draft])
  test(`creating from the ${resource ? "draft page" : "Sessions landing"} opens its resource page`, () => {
    const w = fixture();
    openSessionsPage(w, resource);
    complete(context(w));
    expect(w.pages.store.getState().location?.page).toEqual(workbenchPages.session);
    expect(w.pages.getContent()?.resource?.id).toBe("created");
    expect(w.layout.listPanelInstances("main")).toEqual([]);
  });

test("a completed creation keeps the page the user opened while it was pending", () => {
  const w = fixture();
  const input = context(w);
  navigateDashboardPage(w, { page: workbenchPages.start });
  complete(input);
  expect(w.pages.store.getState().location?.page).toEqual(workbenchPages.start);
});

test("a panel draft completes in its actual region after moving", async () => {
  const w = fixture();
  await w.navigation.openPanel({ panel: workbenchPanels.projectSession, resource: draft, region: "side", open: "pin" });
  const input = context(w, "side");
  w.movePanel(input.instance.instanceId, "secondary");
  const location = w.pages.store.getState().location;
  complete(input);
  expect(w.pages.store.getState().location).toBe(location);
  expect(w.layout.getActivePanel("secondary")).toMatchObject({
    instanceId: input.instance.instanceId,
    resource: { id: "created" },
  });
});

test("an inactive draft completing to an existing Main session preserves the active panel", async () => {
  const w = fixture();
  openSessionsPage(w, createDashboardSessionResource("created", "Created", "project-1"));
  await w.navigation.openPanel({ panel: workbenchPanels.projectSession, resource: draft, open: "pin" });
  const input = context(w, "side");
  await w.navigation.openPanel({
    panel: workbenchPanels.projectSession,
    resource: createDashboardSessionResource("active", "Active", "project-1"),
    open: "pin",
  });
  w.focus.setActiveRegion("side");
  complete(input);
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("active");
  expect(w.focus.getActiveRegion()).toBe("side");
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
});

test("a pending landing creation cannot replace another project's landing", () => {
  const w = fixture();
  const input = context(w);
  selectDashboardProject(w, { id: "project-2", name: "Other project" });
  openSessionsPage(w);
  complete(input);
  expect(w.pages.store.getState().projectId).toBe("project-2");
  expect(w.pages.getContent()?.resource).toBeUndefined();
});
