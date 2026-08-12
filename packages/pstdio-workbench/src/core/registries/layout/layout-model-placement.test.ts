import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";
import { registerTestWidget } from "./layout-model-test-utils";

describe("createLayoutModel widget placement", () => {
  test("activates an existing widget placement without adding a duplicate", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
    });
    registerTestWidget(layout, {
      id: "sessions.chat",
      title: "Session chat",
      region: "main",
    });

    const settings = layout.openWidget("project.settings");
    layout.openWidget("sessions.chat");

    const activated = layout.activateWidget(settings.widgetId);

    expect(activated.widgetId).toBe(settings.widgetId);
    expect(layout.getLayout().activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().regions.main.activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().regions.main.widgets.map((placement) => placement.widgetId)).toEqual([
      "project.settings",
      "sessions.chat",
    ]);
  });

  test("replaces the active widget placement when requested", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      region: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
    });

    layout.openWidget("project.tickets", {
      resource: { kind: "dashboard-view", uri: "pstdio://dashboard/tickets", label: "Tickets" },
    });
    const placement = layout.openWidget("project.settings", {
      resource: { kind: "settings", uri: "pstdio://settings/project", label: "Settings" },
      replaceActive: true,
    });

    expect(placement).toMatchObject({
      widgetId: "project.settings",
      contributionId: "project.settings",
      resourceUri: "pstdio://settings/project",
      title: "Settings",
    });
    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
    expect(layout.getLayout().regions.main.widgets[0]).toEqual(placement);
    expect(layout.getLayout().activeWidgetId).toBe("project.settings");
  });

  test("replaceActive removes the active placement when reusing an existing placement", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      region: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
    });

    const tickets = layout.openWidget("project.tickets", {
      resource: { kind: "dashboard-view", uri: "pstdio://dashboard/tickets", label: "Tickets" },
    });
    layout.openWidget("project.settings", {
      resource: { kind: "settings", uri: "pstdio://settings/project", label: "Settings" },
    });

    const placement = layout.openWidget("project.tickets", {
      resource: { kind: "dashboard-view", uri: "pstdio://dashboard/tickets", label: "Tickets" },
      replaceActive: true,
    });

    expect(placement.widgetId).toBe(tickets.widgetId);
    expect(layout.getLayout().regions.main.widgets).toEqual([placement]);
    expect(layout.getLayout().activeWidgetId).toBe(tickets.widgetId);
  });
});

describe("createLayoutModel Location-owned placements", () => {
  test("replaces the active Location instead of its selected Sub Panel during resource presentation", () => {
    const layout = createLayoutModel();

    layout.registerPanel({
      closable: false,
      id: "project.content",
      title: "Project",
      region: "main",
      singleton: false,
      rendererId: "test.renderer",
    });
    layout.registerPanel({
      closable: true,
      eligibleLocations: {},
      id: "project.notes",
      title: "Notes",
      region: "main",
      rendererId: "test.renderer",
    });

    const alphaResource = { kind: "project", uri: "pstdio://project/alpha", label: "Alpha" };
    const betaResource = { kind: "project", uri: "pstdio://project/beta", label: "Beta" };
    const alpha = layout.openPanel("project.content", { resource: alphaResource, strategy: { kind: "persistent" } });
    layout.establishLocation(alpha.instanceId);
    const notes = layout.openPanel("project.notes", { strategy: { kind: "persistent" } });

    const beta = layout.openPanel("project.content", {
      resource: betaResource,
      strategy: { kind: "replace-active" },
    });

    expect(beta.instanceId).toBe(alpha.instanceId);
    expect(layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({ widgetId: beta.instanceId, resourceUri: betaResource.uri }),
      expect.objectContaining({ widgetId: notes.instanceId, ownerResourceUri: alphaResource.uri }),
    ]);
  });

  test("never promotes a Sub Panel placement into a Location", () => {
    const layout = createLayoutModel();

    layout.registerPanel({
      closable: false,
      id: "lab.overview",
      title: "Overview",
      region: "main",
      singleton: false,
      rendererId: "test.renderer",
    });
    layout.registerPanel({
      closable: false,
      eligibleLocations: {},
      id: "lab.cams",
      title: "Cams",
      region: "main",
      rendererId: "test.renderer",
    });

    const overview = layout.openPanel("lab.overview", {
      resource: { kind: "extension-view", uri: "pstdio://view/overview", label: "Overview" },
      strategy: { kind: "persistent" },
    });
    layout.establishLocation(overview.instanceId);
    const cams = layout.openPanel("lab.cams", {
      resource: { kind: "extension-view", uri: "pstdio://view/cams", label: "Cams" },
      strategy: { kind: "persistent" },
    });

    // Seeding or navigation may hand any active placement to establishLocation; a
    // Sub Panel must stay a tab beside the Location, or Sub Panels get cloned per
    // accidental Location.
    layout.establishLocation(cams.instanceId);

    const placements = layout.getLayout().regions.main.widgets;
    expect(placements.find((placement) => placement.widgetId === cams.instanceId)?.role).toBe("sub-panel");
    expect(placements.filter((placement) => placement.role === "location")).toHaveLength(1);
  });

  test("keeps singleton Sub Panels scoped to their Location when switching Locations", () => {
    const layout = createLayoutModel();

    layout.registerLocation({
      id: "project.location",
      title: "Project",
      region: "main",
      singleton: false,
      rendererId: "test.renderer",
    });
    layout.registerSubPanel({
      id: "project.notes",
      title: "Notes",
      region: "main",
      rendererId: "test.renderer",
    });

    const alphaResource = { kind: "project", uri: "pstdio://project/alpha", label: "Alpha" };
    const betaResource = { kind: "project", uri: "pstdio://project/beta", label: "Beta" };
    layout.openWidget("project.location", { resource: alphaResource, replaceActive: true });
    const alphaNotes = layout.openWidget("project.notes");
    layout.openWidget("project.location", { resource: betaResource, replaceActive: true });
    const betaNotes = layout.openWidget("project.notes");

    layout.openWidget("project.location", { resource: alphaResource, replaceActive: true });

    expect(alphaNotes.widgetId).not.toBe(betaNotes.widgetId);
    expect(layout.getLayout().regions.main.widgets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ widgetId: alphaNotes.widgetId, ownerResourceUri: alphaResource.uri }),
        expect.objectContaining({ widgetId: betaNotes.widgetId, ownerResourceUri: betaResource.uri }),
      ]),
    );
    expect(layout.getLayout().regions.main.activeWidgetId).toBe(alphaNotes.widgetId);
  });

  test("reuses a pinned Sub Panel across Locations instead of duplicating chrome", () => {
    const layout = createLayoutModel();

    layout.registerLocation({
      id: "project.location",
      title: "Project",
      region: "main",
      singleton: false,
      rendererId: "test.renderer",
    });
    layout.registerSubPanel({
      id: "lab.sidenav",
      title: "Lab Sidenav",
      region: "side",
      rendererId: "test.renderer",
    });

    const alphaResource = { kind: "project", uri: "pstdio://project/alpha", label: "Alpha" };
    const betaResource = { kind: "project", uri: "pstdio://project/beta", label: "Beta" };
    layout.openWidget("project.location", { resource: alphaResource, replaceActive: true });
    const first = layout.openWidget("lab.sidenav", { pinned: true });
    layout.openWidget("project.location", { resource: betaResource, replaceActive: true });
    const second = layout.openWidget("lab.sidenav", { pinned: true });

    expect(second.widgetId).toBe(first.widgetId);
    const placements = layout
      .getLayout()
      .regions.side.widgets.filter((placement) => placement.contributionId === "lab.sidenav");
    expect(placements).toHaveLength(1);
  });

  test("keeps singleton Panel Menus scoped to their Location", () => {
    const layout = createLayoutModel();

    layout.registerLocation({
      id: "project.location",
      title: "Project",
      region: "main",
      singleton: false,
      rendererId: "test.renderer",
    });
    layout.registerPanelMenu({
      id: "project.inspector",
      title: "Inspector",
      region: "main-right-menu",
      rendererId: "test.renderer",
    });

    const alphaResource = { kind: "project", uri: "pstdio://project/alpha", label: "Alpha" };
    const betaResource = { kind: "project", uri: "pstdio://project/beta", label: "Beta" };
    layout.openWidget("project.location", { resource: alphaResource, replaceActive: true });
    const alphaInspector = layout.openWidget("project.inspector");
    layout.openWidget("project.location", { resource: betaResource, replaceActive: true });
    const betaInspector = layout.openWidget("project.inspector");

    expect(alphaInspector.widgetId).not.toBe(betaInspector.widgetId);
    expect(layout.getLayout().regions["main-right-menu"].widgets).toEqual([
      expect.objectContaining({ widgetId: alphaInspector.widgetId, ownerResourceUri: alphaResource.uri }),
      expect.objectContaining({ widgetId: betaInspector.widgetId, ownerResourceUri: betaResource.uri }),
    ]);
  });
});

describe("createLayoutModel placement lifecycle", () => {
  test("keeps the active Side Panel tab when the primary resource changes", () => {
    const layout = createLayoutModel();
    layout.registerLocation({
      id: "project.workspace",
      title: "Workspace",
      region: "main",
      singleton: false,
      rendererId: "test.renderer",
    });
    for (const id of ["project.files", "project.diff"]) {
      layout.registerSubPanel({
        id,
        title: id,
        region: "side",
        rendererId: "test.renderer",
      });
    }

    layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/a", label: "Workspace A" },
    });
    layout.openWidget("project.files");
    const diff = layout.openWidget("project.diff");
    layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/b", label: "Workspace B" },
      replaceActive: true,
    });

    expect(layout.getLayout().regions.side.activeWidgetId).toBe(diff.widgetId);
  });

  test("replaces the leftmost preview tab without disturbing persistent tabs", () => {
    const layout = createLayoutModel();
    const previewA = { kind: "session", uri: "pstdio://session/a", label: "Session A" };
    const previewB = { kind: "session", uri: "pstdio://session/b", label: "Session B" };

    layout.registerSubPanel({
      id: "project.session",
      title: "Session",
      region: "side",
      singleton: false,
      rendererId: "test.renderer",
    });
    layout.registerSubPanel({
      id: "project.files",
      title: "Files",
      region: "side",
      rendererId: "test.renderer",
    });

    const files = layout.openWidget("project.files");
    const firstPreview = layout.openWidget("project.session", {
      resource: previewA,
      tabRetention: "preview",
      tabPosition: "start",
    });
    const secondPreview = layout.openWidget("project.session", {
      resource: previewB,
      tabRetention: "preview",
      tabPosition: "start",
    });

    expect(secondPreview.widgetId).toBe(firstPreview.widgetId);
    expect(layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({
        widgetId: firstPreview.widgetId,
        resourceUri: previewB.uri,
        tabRetention: "preview",
      }),
      files,
    ]);
  });

  test("reuses matching persistent content when opening a preview from another location", () => {
    const layout = createLayoutModel();
    const session = { kind: "session", uri: "pstdio://session/a", label: "Session A" };

    layout.registerLocation({
      id: "project.workspace",
      title: "Workspace",
      region: "main",
      singleton: false,
      rendererId: "test.renderer",
    });
    layout.registerSubPanel({
      id: "project.session",
      title: "Session",
      region: "side",
      singleton: false,
      rendererId: "test.renderer",
    });

    layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/a", label: "Workspace A" },
    });
    const persistent = layout.openWidget("project.session", {
      resource: session,
      tabRetention: "persistent",
    });
    layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/b", label: "Workspace B" },
    });
    const preview = layout.openWidget("project.session", {
      resource: session,
      tabRetention: "preview",
    });

    expect(preview).toEqual(persistent);
    expect(layout.getLayout().regions.side.widgets).toEqual([persistent]);
    expect(layout.getLayout().regions.side.activeWidgetId).toBe(persistent.widgetId);
  });

  test("opens and reorders persistent tabs by stable positions", () => {
    const layout = createLayoutModel();

    for (const id of ["project.files", "project.diff", "project.terminal"]) {
      layout.registerSubPanel({
        id,
        title: id,
        region: "side",
        rendererId: "test.renderer",
      });
    }

    const files = layout.openWidget("project.files");
    const terminal = layout.openWidget("project.terminal");
    const diff = layout.openWidget("project.diff", {
      tabPosition: { beforeWidgetId: terminal.widgetId },
    });
    layout.reorderWidget(files.widgetId, { afterWidgetId: terminal.widgetId });

    expect(layout.getLayout().regions.side.widgets.map((placement) => placement.widgetId)).toEqual([
      diff.widgetId,
      terminal.widgetId,
      files.widgetId,
    ]);
  });

  test("promotes a preview and expires only previews owned by another resource", () => {
    const layout = createLayoutModel();
    const workspaceA = { kind: "workspace", uri: "pstdio://workspace/a", label: "Workspace A" };
    const workspaceB = { kind: "workspace", uri: "pstdio://workspace/b", label: "Workspace B" };

    layout.registerLocation({
      id: "project.workspace",
      title: "Workspace",
      region: "main",
      singleton: false,
      rendererId: "test.renderer",
    });
    layout.registerSubPanel({
      id: "project.session",
      title: "Session",
      region: "side",
      singleton: false,
      rendererId: "test.renderer",
    });

    layout.openWidget("project.workspace", { resource: workspaceA });
    const carried = layout.openWidget("project.session", { tabRetention: "preview" });
    layout.updateWidgetPlacement(carried.widgetId, { tabRetention: "persistent" });
    const expiring = layout.openWidget("project.session", {
      resource: { kind: "session", uri: "pstdio://session/b", label: "Session B" },
      tabRetention: "preview",
    });

    layout.expirePreviewTabs(workspaceB.uri);

    expect(layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({ widgetId: carried.widgetId, tabRetention: "persistent" }),
    ]);
    expect(layout.getLayout().regions.side.widgets).not.toContainEqual(
      expect.objectContaining({ widgetId: expiring.widgetId }),
    );
  });
});

describe("createLayoutModel placement management", () => {
  test("replaces one explicit Sub Panel placement without creating another tab", () => {
    const layout = createLayoutModel();
    const sessionA = { kind: "session", uri: "pstdio://session/a", label: "Session A" };
    const sessionB = { kind: "session", uri: "pstdio://session/b", label: "Session B" };
    const sessionC = { kind: "session", uri: "pstdio://session/c", label: "Session C" };

    layout.registerSubPanel({
      id: "project.session",
      title: "Session",
      region: "side",
      singleton: false,
      rendererId: "test.renderer",
    });

    const first = layout.openWidget("project.session", { resource: sessionA, pinned: true });
    const second = layout.openWidget("project.session", { resource: sessionB });
    const replaced = layout.openWidget("project.session", {
      resource: sessionC,
      replaceWidgetId: first.widgetId,
    });

    expect(replaced.widgetId).toBe(first.widgetId);
    expect(layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({ widgetId: first.widgetId, resourceUri: sessionC.uri }),
      expect.objectContaining({ widgetId: second.widgetId, resourceUri: sessionB.uri }),
    ]);
    expect(layout.getLayout().regions.side.activeWidgetId).toBe(first.widgetId);
  });

  test("moves a reusable placement when reopened in a different region without a resource update", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "ticket.files",
      title: "Files",
      region: "sidenav",
    });

    const placement = layout.openWidget("ticket.files", { title: "Ticket files" });
    const moved = layout.openWidget("ticket.files", { region: "main-right-menu", title: "Ticket files" });

    expect(moved.widgetId).toBe(placement.widgetId);
    expect(layout.getLayout().regions.sidenav.widgets).toEqual([]);
    expect(layout.getLayout().regions["main-right-menu"].widgets).toEqual([moved]);
    expect(layout.getLayout().regions["main-right-menu"].activeWidgetId).toBe(moved.widgetId);
    expect(layout.getLayout().activeWidgetId).toBe(moved.widgetId);
  });

  test("closes closable widget placements", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      region: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
      closable: true,
    });

    const tickets = layout.openWidget("project.tickets");
    const settings = layout.openWidget("project.settings");

    layout.closeWidget(settings.widgetId);

    expect(layout.getLayout().regions.main.widgets).toEqual([tickets]);
    expect(layout.getLayout().regions.main.activeWidgetId).toBe(tickets.widgetId);
    expect(layout.getLayout().activeWidgetId).toBe(tickets.widgetId);
    expect(() => layout.closeWidget(tickets.widgetId)).toThrow("Widget cannot be closed: project.tickets");
  });

  test("removes placements when a widget contribution is disposed", () => {
    const layout = createLayoutModel();

    const disposable = registerTestWidget(layout, {
      id: "mode.editor",
      title: "Editor",
      region: "main",
    });

    layout.openWidget("mode.editor", {
      resource: { kind: "note", uri: "pstdio://note/1", label: "Note 1" },
    });

    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
    expect(layout.getLayout().activeWidgetId).toBe("mode.editor");

    disposable.dispose();

    expect(layout.getLayout().regions.main.widgets).toHaveLength(0);
    expect(layout.getLayout().regions.main.activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });

  test("opens priority-placed widgets beside preserved unregistered placements", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "session-chat-bubble",
      title: "Session chat bubble",
      region: "side",
      priority: -1,
    });
    registerTestWidget(layout, {
      id: "project.notes",
      title: "Notes",
      region: "side",
      priority: 1,
    });

    layout.openWidget("session-chat-bubble");
    layout.unregisterWidget("session-chat-bubble", { removePlacements: false, persist: false });
    const notes = layout.openWidget("project.notes");

    expect(layout.getLayout().regions.side.widgets.map((placement) => placement.widgetId)).toEqual([
      notes.widgetId,
      "session-chat-bubble",
    ]);
  });

  test("resets every region and clears active workbench selection", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "modes.switcher",
      title: "Modes",
      region: "activity",
    });
    registerTestWidget(layout, {
      id: "sessions.tree",
      title: "Sessions",
      region: "sidenav",
    });
    registerTestWidget(layout, {
      id: "sessions.chat",
      title: "Session",
      region: "main",
    });

    layout.openWidget("modes.switcher", { pinned: true });
    layout.openWidget("sessions.tree");
    layout.openWidget("sessions.chat", {
      resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" },
    });

    layout.resetRegions();

    expect(layout.getLayout().regions.activity.widgets).toEqual([]);
    expect(layout.getLayout().regions.sidenav.widgets).toEqual([]);
    expect(layout.getLayout().regions.main.widgets).toEqual([]);
    expect(layout.getLayout().regions.main.activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });

  test("resetRegions preserves region visibility", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "sessions.tree",
      title: "Sessions",
      region: "sidenav",
    });
    layout.openWidget("sessions.tree");

    const before = layout.getLayout().regions.sidenav.visible;
    layout.resetRegions();

    expect(layout.getLayout().regions.sidenav.visible).toBe(before);
  });

  test("clears an region and active workbench selection", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      region: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
    });

    layout.openWidget("project.tickets");
    layout.openWidget("project.settings", {
      resource: { kind: "project", uri: "pstdio://project/project-1", label: "Project" },
    });

    layout.clearRegion("main");

    expect(layout.getLayout().regions.main.widgets).toEqual([]);
    expect(layout.getLayout().regions.main.activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });
});
