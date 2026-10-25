import { describe, expect, test } from "bun:test";
import { createWorkbench, type WorkbenchCore } from "../../core";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "../../react";
import { buildSettingsTreeBody } from "../../react/settings/settings-tree";
import { createSettingsModule } from "./module";

const activeOverlayResource = (workbench: WorkbenchCore) => {
  return workbench.layout.getActivePanel("overlay")?.resource;
};

const setup = () => {
  const workbench = createWorkbench();
  workbench.registerModule(createSettingsModule());
  return workbench;
};

describe("settings example module", () => {
  test("derives a grouped tree from the registry, including a collection's items", async () => {
    const workbench = setup();
    const body = await buildSettingsTreeBody({
      settings: workbench.settings,
      hasProjectScope: true,
      matchesWhen: (when) => workbench.context.matches(when),
    });

    const workbenchSection = body.find((section) => section.id === "workbench");
    expect(workbenchSection?.nodes.map((node) => node.label)).toEqual(["Appearance", "Editor"]);

    const extensionsSection = body.find((section) => section.id === "extensions");
    const snippets = extensionsSection?.nodes.find((node) => node.label === "Snippets");
    expect(snippets?.actions?.[0]?.label).toBe("Create snippet");
    expect(snippets?.children?.map((group) => group.label)).toEqual(["Prose", "Code"]);
    expect(snippets?.children?.[0]?.children?.length ?? 0).toBeGreaterThan(0);
  });

  test("hides project-scoped entries when there is no project scope", async () => {
    const workbench = setup();
    const body = await buildSettingsTreeBody({
      settings: workbench.settings,
      hasProjectScope: false,
      matchesWhen: (when) => workbench.context.matches(when),
    });

    expect(body.find((section) => section.id === "workbench")?.nodes.map((node) => node.label)).toEqual(["Appearance"]);
    expect(body.find((section) => section.id === "extensions")?.nodes.map((node) => node.label)).toEqual(["Lab"]);
  });

  test("keeps the settings tree visible when a collection fails to load", async () => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: "runtime-settings",
      title: "Runtime settings",
      body: { kind: "react", render: () => null },
    });
    workbench.views.registerView({
      id: "skill-settings",
      title: "Skill settings",
      body: { kind: "react", render: () => null },
    });
    workbench.settings.registerSection({ id: "workbench", title: "Workbench", order: 10 });
    workbench.settings.registerSection({ id: "project", title: "Project", order: 20 });
    workbench.settings.registerPanel({
      kind: "view",
      id: "runtime",
      title: "Runtime",
      section: "workbench",
      viewId: "runtime-settings",
    });
    workbench.settings.registerPanel({
      kind: "collection",
      id: "skills",
      title: "Skills",
      section: "project",
      items: async () => {
        throw new Error("package.json is missing");
      },
      itemId: (item) => String(item),
      itemLabel: (item) => String(item),
      viewId: "skill-settings",
    });

    const body = await buildSettingsTreeBody({
      settings: workbench.settings,
      hasProjectScope: true,
      matchesWhen: (when) => workbench.context.matches(when),
    });

    expect(body.find((section) => section.id === "workbench")?.nodes.map((node) => node.label)).toEqual(["Runtime"]);
    expect(body.find((section) => section.id === "project")?.nodes.map((node) => node.label)).toEqual(["Skills"]);
  });

  test("the settings command swaps the overlay across schema, custom, and collection entries", async () => {
    const workbench = setup();

    await workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "appearance" });
    expect(activeOverlayResource(workbench)?.metadata?.panelId).toBe("appearance");

    await workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "lab" });
    expect(activeOverlayResource(workbench)?.metadata?.panelId).toBe("lab");

    await workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, {
      panelId: "snippets",
      itemId: "greeting",
    });
    expect(activeOverlayResource(workbench)?.metadata?.itemId).toBe("greeting");
  });

  test("does not open a panel until its context condition matches", async () => {
    const workbench = setup();
    workbench.settings.registerPanel({
      kind: "schema",
      id: "conditional",
      title: "Conditional",
      section: "extensions",
      when: "templates.available",
      preferences: [],
    });

    await workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "conditional" });
    expect(activeOverlayResource(workbench)?.metadata?.panelId).toBe("appearance");

    workbench.context.set("templates.available", true);
    await workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "conditional" });
    expect(activeOverlayResource(workbench)?.metadata?.panelId).toBe("conditional");
  });
});
