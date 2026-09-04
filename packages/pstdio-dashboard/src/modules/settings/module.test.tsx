import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
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

  test("registers the extensions, repositories, skills, and danger-zone panels", () => {
    const workbench = createWorkbench();

    workbench.registerModule(createSettingsModule());

    const panels = workbench.settings.listPanels();
    const byId = (id: string) => panels.find((panel) => panel.id === id);

    expect(byId("harnesses")).toBeUndefined();
    expect(byId("extensions")).toMatchObject({ kind: "view", scope: "project" });
    expect(byId("repositories")).toMatchObject({ kind: "view", scope: "project" });
    expect(byId("skills")).toMatchObject({ kind: "collection", scope: "project" });
    expect(byId("danger-zone")).toMatchObject({ kind: "view", scope: "project" });
  });
});
