import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { getSidePanelBubblePanels, openSidePanelBubble, sidePanelBubblePreferences } from "./side-panel-bubble";

test("the bubble defaults to visible, right aligned, and the host's default panel", () => {
  const workbench = createWorkbench();
  expect(workbench.preferences.getValue(sidePanelBubblePreferences.visible)).toBe(true);
  expect(workbench.preferences.getValue(sidePanelBubblePreferences.alignment)).toBe("right");
  expect(workbench.preferences.getValue(sidePanelBubblePreferences.panel)).toBe("default");
});

test("the chosen panel opens beside Main and is reused when its singleton is already open", async () => {
  const workbench = createWorkbench({ initialSidePanelMode: "closed" });
  workbench.layout.registerPanel({ id: "main", title: "Main", region: "main", rendererId: "main" });
  const main = workbench.layout.openPanel("main");
  workbench.layout.registerPanel({
    id: "inspector",
    title: "Inspector",
    region: "side",
    rendererId: "inspector",
    singleton: true,
    eligibleLocations: {},
  });
  await workbench.preferences.setValue(sidePanelBubblePreferences.panel, "panel:inspector", { scope: "user" });
  await openSidePanelBubble(workbench);
  const panel = workbench.layout.getActivePanel("side");
  expect(panel?.panelId).toBe("inspector");
  expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(main.instanceId);
  expect(workbench.sidePanel.getMode()).toBe("floating");
  expect(workbench.composition.panelsFor("side").addable).toHaveLength(0);
  expect(getSidePanelBubblePanels(workbench)).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "inspector", title: "Inspector" })]),
  );
  workbench.sidePanel.setMode("closed");
  await openSidePanelBubble(workbench);
  expect(workbench.layout.getActivePanel("side")?.instanceId).toBe(panel?.instanceId);
  expect(workbench.layout.listPanelInstances("side")).toHaveLength(1);
  workbench.movePanel(panel!.instanceId, "main");
  expect(getSidePanelBubblePanels(workbench)).toEqual(
    expect.arrayContaining([{ id: "inspector", title: "Inspector" }]),
  );
  workbench.sidePanel.setMode("closed");
  await openSidePanelBubble(workbench);
  expect(workbench.layout.getActivePanel("side")?.instanceId).toBe(panel!.instanceId);
  expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(main.instanceId);
});

test("a removed panel falls back to the Side Panel without running the host default", async () => {
  const workbench = createWorkbench({ initialSidePanelMode: "closed" });
  const registration = workbench.layout.registerPanel({
    id: "inspector",
    title: "Inspector",
    region: "side",
    rendererId: "inspector",
    eligibleLocations: {},
  });
  await workbench.preferences.setValue(sidePanelBubblePreferences.panel, "panel:inspector", { scope: "user" });
  registration.dispose();
  let openedDefault = false;
  await openSidePanelBubble(workbench, () => {
    openedDefault = true;
  });
  expect(openedDefault).toBe(false);
  expect(workbench.sidePanel.getMode()).toBe("floating");
  expect(workbench.layout.listPanelInstances("side")).toHaveLength(0);
  expect(workbench.preferences.getValue(sidePanelBubblePreferences.panel)).toBe("panel:inspector");
});

for (const singleton of [false, true]) {
  test(`a different view override opens the chosen view with ${singleton ? "one tab" : "multiple tabs"}`, async () => {
    const workbench = createWorkbench({ initialSidePanelMode: "closed" });
    workbench.layout.registerPanel({
      id: "conversation",
      title: "Conversation",
      region: "side",
      rendererId: "conversation",
      singleton,
      eligibleLocations: {},
      openCommand: { commandId: "new-conversation" },
    });
    workbench.commands.registerCommand(
      { id: "new-conversation", label: "New conversation" },
      {
        execute: () =>
          workbench.layout.openPanel("conversation", {
            resource: { type: "conversation", id: "new" },
            viewId: "conversation",
            strategy: { kind: "persistent" },
          }),
      },
    );
    const reader = workbench.layout.openPanel("conversation", {
      resource: { type: "conversation", id: "existing" },
      viewId: "reader",
      strategy: { kind: "persistent" },
    });
    await workbench.preferences.setValue(sidePanelBubblePreferences.panel, "panel:conversation", { scope: "user" });
    await openSidePanelBubble(workbench);
    const panel = workbench.layout.getActivePanel("side")!;
    expect(panel.viewId ?? workbench.layout.getPanel(panel.panelId)?.rendererId).toBe("conversation");
    expect(panel.resource?.id).toBe(singleton ? "existing" : "new");
    if (singleton) {
      expect(panel.instanceId).toBe(reader.instanceId);
      workbench.movePanel(panel.instanceId, "main");
      workbench.layout.updatePanel(panel.instanceId, { viewId: "reader" });
      workbench.sidePanel.setMode("closed");
      await openSidePanelBubble(workbench);
      const reopened = workbench.layout.getActivePanel("side")!;
      expect(reopened.instanceId).toBe(reader.instanceId);
      expect(reopened.viewId ?? workbench.layout.getPanel(reopened.panelId)?.rendererId).toBe("conversation");
      expect(reopened.resource?.id).toBe("existing");
    } else expect(panel.instanceId).not.toBe(reader.instanceId);
  });
}

test("the generic Side Panel preference bypasses the optional host default", async () => {
  const workbench = createWorkbench({ initialSidePanelMode: "closed" });
  let openedDefault = 0;
  const openDefault = () => {
    openedDefault++;
    workbench.sidePanel.setMode("floating");
  };
  await openSidePanelBubble(workbench, openDefault);
  expect(openedDefault).toBe(1);
  workbench.sidePanel.setMode("closed");
  await workbench.preferences.setValue(sidePanelBubblePreferences.panel, "none", { scope: "user" });
  await openSidePanelBubble(workbench, openDefault);
  expect(openedDefault).toBe(1);
  expect(workbench.sidePanel.getMode()).toBe("floating");
});
