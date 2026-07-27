import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type WorkbenchCore } from "../../core";
import { buildSettingsTreeBody, settingsItemResource, settingsPanelResource } from "../../react";
import { createSettingsModule } from "./module";

const activeOverlayResource = (workbench: WorkbenchCore) => {
  return workbench.layout.getActivePanel("overlay")?.resource;
};

const setup = () => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createSettingsModule());
  return workbench;
};

describe("settings example module", () => {
  test("derives a grouped tree from the registry, including a collection's items", async () => {
    const workbench = setup();
    const body = await buildSettingsTreeBody({ settings: workbench.settings, hasProjectScope: true });

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
    const body = await buildSettingsTreeBody({ settings: workbench.settings, hasProjectScope: false });

    expect(body.find((section) => section.id === "workbench")?.nodes.map((node) => node.label)).toEqual(["Appearance"]);
    expect(body.find((section) => section.id === "extensions")?.nodes.map((node) => node.label)).toEqual(["Lab"]);
  });

  test("keeps the settings tree visible when a collection fails to load", async () => {
    const workbench = createWorkbenchCore();
    workbench.settings.registerSection({ id: "workbench", title: "Workbench", order: 10 });
    workbench.settings.registerSection({ id: "project", title: "Project", order: 20 });
    workbench.settings.registerPanel({
      kind: "custom",
      id: "runtime",
      title: "Runtime",
      section: "workbench",
      render: () => null,
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
      renderItem: () => null,
    });

    const body = await buildSettingsTreeBody({ settings: workbench.settings, hasProjectScope: true });

    expect(body.find((section) => section.id === "workbench")?.nodes.map((node) => node.label)).toEqual(["Runtime"]);
    expect(body.find((section) => section.id === "project")?.nodes.map((node) => node.label)).toEqual(["Skills"]);
  });

  test("presenter swaps the overlay panel across schema, custom, and collection-item resources", async () => {
    const workbench = setup();

    await workbench.resources.openResource(settingsPanelResource({ id: "appearance", title: "Appearance" }));
    expect(activeOverlayResource(workbench)?.metadata?.panelId).toBe("appearance");

    await workbench.resources.openResource(settingsPanelResource({ id: "lab", title: "Lab" }));
    expect(activeOverlayResource(workbench)?.metadata?.panelId).toBe("lab");

    await workbench.resources.openResource(settingsItemResource("snippets", { id: "greeting", label: "Greeting" }));
    expect(activeOverlayResource(workbench)?.metadata?.itemId).toBe("greeting");
  });
});
