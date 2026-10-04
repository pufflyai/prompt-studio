import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench } from "@pstdio/workbench";
import { registerWorkbenchExtensionContributions } from "@pstdio/workbench/extensions";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { dashboardEditableTemplatesContextKey } from "@/shared/extensions/workbench-extension-contributions";
import { createSettingsModule } from "./module";

describe("createSettingsModule", () => {
  test("registers the settings command", () => {
    const workbench = createWorkbench();

    workbench.registerModule(createSettingsModule());

    expect(workbench.commands.getCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID)).toBeDefined();
  });

  test("registers the workbench and project settings sections", () => {
    const workbench = createWorkbench();

    workbench.registerModule(createSettingsModule());

    const sectionIds = workbench.settings.listSections().map((section) => section.id);
    expect(sectionIds).toContain("workbench");
    expect(sectionIds).toContain("project");
  });

  test("registers Settings once on the shared project sidenav footer", async () => {
    const workbench = createWorkbench();

    workbench.registerModule(createSettingsModule());

    const projectNodes = (
      await workbench.navigationTrees.getSections({ kind: "mode", id: "project", extensionId: "pstdio" }, "footer")
    ).flatMap((section) => section.nodes);
    const sessionNodes = (
      await workbench.navigationTrees.getSections({ kind: "mode", id: "sessions", extensionId: "pstdio" }, "footer")
    ).flatMap((section) => section.nodes);

    expect(projectNodes.map((node) => node.label)).toContain("Settings");
    expect(sessionNodes).toEqual([]);
  });

  test("registers the runtime and templates panels with their scope and kind", () => {
    const workbench = createWorkbench();

    workbench.registerModule(createSettingsModule());

    const panels = workbench.settings.listPanels();
    const runtime = panels.find((panel) => panel.id === "runtime");
    const templates = panels.find((panel) => panel.id === "templates");

    expect(runtime).toMatchObject({ kind: "view", scope: "global" });
    expect(templates).toMatchObject({
      kind: "collection",
      scope: "project",
      when: dashboardEditableTemplatesContextKey,
    });
  });

  test("registers the extensions, project-folder, skills, and danger-zone panels", () => {
    const workbench = createWorkbench();

    workbench.registerModule(createSettingsModule());

    const panels = workbench.settings.listPanels();
    const byId = (id: string) => panels.find((panel) => panel.id === id);

    expect(byId("harnesses")).toBeUndefined();
    expect(byId("extensions")).toMatchObject({ kind: "view", scope: "project" });
    expect(byId("project-folder")).toMatchObject({ kind: "view", scope: "project" });
    expect(byId("skills")).toMatchObject({ kind: "collection", scope: "project" });
    expect(byId("danger-zone")).toMatchObject({ kind: "view", scope: "project" });
  });

  test("keeps Danger zone below the panels extensions add to the Project group", () => {
    const workbench = createWorkbench();
    workbench.registerModule(createSettingsModule());
    const extensionId = "pstdio.pstdio-planner";
    const metadata = {
      extensions: [],
      commands: [],
      diagnostics: [],
      menuContributions: [],
      commandPaletteContributions: [],
      modes: [],
      pages: [],
      views: [
        {
          id: `${extensionId}.view.ticket-tags-settings`,
          localId: "ticket-tags-settings",
          extensionId,
          title: "Ticket tags",
          body: {
            kind: "webview",
            webview: {
              entry: { kind: "package-asset", path: "./src/tags.tsx", baseUrl: "file:///extension/" },
              runtimeUrl: "/v1/extensions/runtime",
              moduleUrl: "/v1/extensions/installed/pstdio-planner/webviews/ticket-tags-settings/module.js",
              originLabel: "ext-0123456789abcdef01234567",
            },
          },
        },
      ],
      viewMenus: [],
      placements: [],
      resourceKinds: [],
      resourceHierarchyProviders: [],
      navigationItems: [],
      navigationTrees: [],
      statusBarItems: [],
      statuses: [],
      activityItems: [],
      settingsSections: [],
      settingsPanels: [
        {
          id: `${extensionId}.settings-panel.ticket-tags`,
          extensionId,
          view: { extensionId, kind: "view", id: "ticket-tags-settings" },
          slot: { id: "project.settingsPanels" },
        },
      ],
      commandPaletteResources: [],
      keybindings: [],
      settingsDefinitions: [],
    } satisfies WorkbenchExtensionMetadata;

    registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata,
      projectId: "project-1",
      settingsSectionId: "project",
      settingsSectionTitle: "Project",
      workbench,
    });

    const projectPanels = workbench.settings
      .listPanels()
      .filter((panel) => panel.section === "project")
      .map((panel) => panel.id);
    expect(projectPanels).toContain(`${extensionId}.settings-panel.ticket-tags`);
    expect(projectPanels.at(-1)).toBe("danger-zone");
  });
});
