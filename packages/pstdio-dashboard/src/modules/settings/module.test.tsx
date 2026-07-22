import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import {
  buildSettingsTreeBody,
  SETTINGS_RESOURCE_KIND,
  WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
} from "@pstdio/workbench/react";
import { getSidenavContributionFooterNodes } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { createSettingsModule } from "./module";

const collectNodeLabels = (sections: Awaited<ReturnType<typeof buildSettingsTreeBody>>) => {
  const labels: string[] = [];
  const visit = (nodes: { label?: string; children?: { label?: string }[] }[]) => {
    for (const node of nodes) {
      if (node.label) labels.push(node.label);
      if (node.children) visit(node.children as typeof nodes);
    }
  };
  for (const section of sections) visit(section.nodes);
  return labels;
};

describe("createSettingsModule", () => {
  test("registers the settings resource kind and the open command", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSettingsModule());

    expect(workbench.resources.getKind(SETTINGS_RESOURCE_KIND)?.icon).toBe("settings");
    expect(workbench.commands.getCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID)).toBeDefined();
  });

  test("registers the workbench and project settings sections", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSettingsModule());

    const sectionIds = workbench.settings.listSections().map((section) => section.id);
    expect(sectionIds).toContain("workbench");
    expect(sectionIds).toContain("project");
  });

  test("keeps Settings in the sessions sidenav footer", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSettingsModule());

    expect(getSidenavContributionFooterNodes(workbench, "sessions").map((node) => node.label)).toContain("Settings");
  });

  test("registers the runtime and templates panels with their scope and kind", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSettingsModule());

    const panels = workbench.settings.listPanels();
    const runtime = panels.find((panel) => panel.id === "runtime");
    const templates = panels.find((panel) => panel.id === "templates");

    expect(runtime).toMatchObject({ kind: "custom", scope: "global" });
    expect(templates).toMatchObject({ kind: "collection", scope: "project" });
  });

  test("registers the extensions, repositories, skills, and danger-zone panels", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSettingsModule());

    const panels = workbench.settings.listPanels();
    const byId = (id: string) => panels.find((panel) => panel.id === id);

    expect(byId("harnesses")).toBeUndefined();
    expect(byId("extensions")).toMatchObject({ kind: "custom", scope: "project" });
    expect(byId("repositories")).toMatchObject({ kind: "custom", scope: "project" });
    expect(byId("skills")).toMatchObject({ kind: "collection", scope: "project" });
    expect(byId("danger-zone")).toMatchObject({ kind: "custom", scope: "project" });
  });

  test("hides project-scoped entries when no project is selected", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSettingsModule());

    const body = await buildSettingsTreeBody({ settings: workbench.settings, hasProjectScope: false });
    const labels = collectNodeLabels(body);

    expect(labels).toContain("Runtime");
    expect(labels).not.toContain("Templates");
  });
});
