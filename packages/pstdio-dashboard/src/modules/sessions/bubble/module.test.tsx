import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { createDashboardResource, dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createSessionBubbleModule } from "./module";

describe("createSessionBubbleModule", () => {
  test("registers the Session Panel for project home without opening a rogue tab", () => {
    const workbench = createWorkbenchCore();
    workbench.resources.registerKind({ kind: "workspace", label: "Workspace" });
    workbench.resources.registerKind({ kind: "recipe", label: "Recipe" });

    workbench.registerModule(createSessionBubbleModule());

    const layout = workbench.layout.getLayout();

    expect(layout.regions.side.widgets).toEqual([]);
    expect(layout.regions["side-header"].widgets).toEqual([]);
    const contribution = workbench.layout.getPanel(dashboardWidgetIds.sessionBubble);
    expect(contribution).toMatchObject({
      region: "side",
      openCommandId: dashboardCommandIds.createSession,
      tab: {
        contentRendererId: "dashboard-workbench.session-tab",
        customMenuRendererId: "dashboard-workbench.session-tab-menu",
      },
    });
    expect(contribution).not.toHaveProperty("closable");
    const canOpenLocation = contribution?.eligibleLocations?.canOpenLocation;
    expect(canOpenLocation?.({ viewId: dashboardViews.sessions.id })).toBe(false);
    expect(canOpenLocation?.({ viewId: dashboardViews.start.id })).toBe(true);
    expect(canOpenLocation?.({ viewId: "pstdio-planner.tickets" })).toBe(true);
    expect(canOpenLocation?.({ viewId: "font-editor" })).toBe(true);
    expect(canOpenLocation?.({ resource: { kind: "workspace", uri: "workspace://one" } })).toBe(true);
    expect(canOpenLocation?.({ resource: { kind: "recipe", uri: "recipe://one" } })).toBe(true);
    expect(canOpenLocation?.({ resource: { kind: "session", uri: "session://one" } })).toBe(false);
    expect(canOpenLocation?.({ resource: { kind: "unknown", uri: "unknown://one" } })).toBe(false);
  });

  test("opens a workspace-linked session draft from the create session command", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSessionBubbleModule());

    await workbench.commands.executeCommand(dashboardCommandIds.createSession, { workspace });

    const placement = workbench.layout
      .getLayout()
      .regions.side.widgets.find((widget) => widget.resource?.kind === "session-draft");

    expect(placement?.resource?.kind).toBe("session-draft");
    expect(placement?.resource?.metadata?.workspaceId).toBe("workspace-1");
    expect(placement?.resource?.metadata?.workspaceShorthand).toBe("PS-307_A1");
  });

  test("reuses the selected Session Sub Panel for session changes and new drafts", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });
    const firstSession = createDashboardResource("session", "session-1", "First session", "MessageCircle", "project-1");
    const secondSession = createDashboardResource(
      "session",
      "session-2",
      "Second session",
      "MessageCircle",
      "project-1",
    );

    workbench.registerModule(createSessionBubbleModule());

    const firstPlacement = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: firstSession,
    });
    const secondPlacement = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: secondSession,
    });
    await workbench.commands.executeCommand(dashboardCommandIds.createSession, { workspace });

    const placements = workbench.layout
      .getLayout()
      .regions.side.widgets.filter((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble);

    expect(placements).toHaveLength(1);
    expect((firstPlacement as { instanceId: string }).instanceId).toBe(
      (secondPlacement as { instanceId: string }).instanceId,
    );
    expect(placements[0]?.widgetId).toBe((firstPlacement as { instanceId: string }).instanceId);
    expect(placements[0]?.resource?.kind).toBe("session-draft");
    expect(placements[0]?.closable).toBe(true);
  });

  test("keeps an Add Panel session as its own tab while later sessions reuse the preview", async () => {
    const workbench = createWorkbenchCore();
    const firstSession = createDashboardResource("session", "session-1", "First session", "MessageCircle", "project-1");
    const secondSession = createDashboardResource(
      "session",
      "session-2",
      "Second session",
      "MessageCircle",
      "project-1",
    );
    workbench.registerModule(createSessionBubbleModule());

    const firstPlacement = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: firstSession,
    });
    const addedPlacement = await workbench.commands.executeCommand(dashboardCommandIds.createSession, undefined, {
      source: "panel-add",
    });
    const selectedPlacement = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: secondSession,
    });
    const placements = workbench.layout
      .getLayout()
      .regions.side.widgets.filter((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble);

    expect(placements).toHaveLength(2);
    expect((addedPlacement as { instanceId: string }).instanceId).not.toBe(
      (firstPlacement as { instanceId: string }).instanceId,
    );
    expect((selectedPlacement as { instanceId: string }).instanceId).toBe(
      (firstPlacement as { instanceId: string }).instanceId,
    );
    expect(
      placements.find((placement) => placement.widgetId === (selectedPlacement as { instanceId: string }).instanceId),
    ).toMatchObject({ resourceUri: secondSession.uri, tabRetention: "preview" });
    expect(
      placements.find((placement) => placement.widgetId === (addedPlacement as { instanceId: string }).instanceId),
    ).toMatchObject({ tabRetention: "persistent" });
  });

  test("turns a persistent session tab back into a preview when the picker replaces it", async () => {
    const workbench = createWorkbenchCore();
    const session = createDashboardResource("session", "session-2", "Second session", "MessageCircle", "project-1");
    workbench.registerModule(createSessionBubbleModule());

    const persistentPlacement = await workbench.commands.executeCommand(dashboardCommandIds.createSession, undefined, {
      source: "panel-add",
    });
    const replacement = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: session,
      replaceWidgetId: (persistentPlacement as { instanceId: string }).instanceId,
    });

    expect(replacement).toMatchObject({
      instanceId: (persistentPlacement as { instanceId: string }).instanceId,
      resourceUri: session.uri,
      tabRetention: "preview",
    });
  });

  test("opens a session selected from New session without replacing another preview", async () => {
    const workbench = createWorkbenchCore();
    const sessionOne = createDashboardResource("session", "session-1", "ONE", "MessageCircle", "project-1");
    const sessionTwo = createDashboardResource("session", "session-2", "TWO", "MessageCircle", "project-1");
    workbench.registerModule(createSessionBubbleModule());

    const previewTwo = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: sessionTwo,
    });
    await workbench.commands.executeCommand(dashboardCommandIds.createSession, undefined, { source: "panel-add" });

    const existingTwo = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: sessionTwo,
      tabRetention: "persistent",
    });
    expect(existingTwo).toMatchObject({
      instanceId: (previewTwo as { instanceId: string }).instanceId,
      tabRetention: "preview",
    });

    const openedOne = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: sessionOne,
      tabRetention: "persistent",
    });
    const placements = workbench.layout
      .getLayout()
      .regions.side.widgets.filter((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble);

    expect(placements).toHaveLength(3);
    expect(placements).toContainEqual(
      expect.objectContaining({ resourceUri: sessionTwo.uri, tabRetention: "preview" }),
    );
    expect(openedOne).toMatchObject({ resourceUri: sessionOne.uri, tabRetention: "persistent" });
  });

  test("reuses a session tab when an extension link uses a different resource URI", async () => {
    const workbench = createWorkbenchCore();
    const dashboardSession = createDashboardResource("session", "session-1", "Session A", "MessageCircle", "project-1");
    const extensionSession = {
      kind: "session",
      uri: "pstdio://extension-resource/session/session-1",
      id: "session-1",
      label: "Session A",
      metadata: { sessionSurface: "side" },
    };
    workbench.registerModule(createSessionBubbleModule());

    const existing = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: dashboardSession,
      tabRetention: "persistent",
    });
    const selected = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: extensionSession,
    });
    const placements = workbench.layout
      .listPanelInstances("side")
      .filter((instance) => instance.panelId === dashboardWidgetIds.sessionBubble);

    expect(placements).toHaveLength(1);
    expect((selected as { instanceId: string }).instanceId).toBe((existing as { instanceId: string }).instanceId);
    expect(selected).toMatchObject({ resourceUri: dashboardSession.uri, tabRetention: "persistent" });
  });
});
