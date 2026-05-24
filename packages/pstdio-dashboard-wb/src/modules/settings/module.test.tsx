import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { selectDashboardProject } from "../../shared/project-context";
import { dashboardSettingsResources } from "../../shared/resources";
import { createSessionsModule } from "../sessions/module";
import { createSettingsModule } from "./module";
import { dashboardSettingsNavigationTreeViewId } from "./settings-nav";

describe("createSettingsModule", () => {
  test("registers the project settings resource kind", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSettingsModule());

    expect(workbench.resources.getKind("project-settings")).toMatchObject({
      label: "Project settings",
      icon: "Settings",
    });
  });

  test("registers the project settings sections as workbench resources", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSettingsModule());

    expect(workbench.resources.listResources("").map((entry) => entry.resource.uri)).toEqual(
      expect.arrayContaining([
        dashboardSettingsResources.runtime.uri,
        dashboardSettingsResources.harnesses.uri,
        dashboardSettingsResources.extensions.uri,
        dashboardSettingsResources.repositories.uri,
        dashboardSettingsResources.attemptStatuses.uri,
        dashboardSettingsResources.dangerZone.uri,
      ]),
    );
  });

  test("renders the projectless settings navigation tree with runtime and harnesses", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionsModule());
    workbench.registerModule(createSettingsModule());
    workbench.modes.setActiveMode("settings");

    await expect(workbench.renderers.getBody(dashboardSettingsNavigationTreeViewId)).resolves.toEqual([
      expect.objectContaining({
        id: "runtime-harnesses",
        nodes: [
          expect.objectContaining({ id: dashboardSettingsResources.runtime.uri, label: "Runtime" }),
          expect.objectContaining({ id: dashboardSettingsResources.harnesses.uri, label: "Harnesses" }),
        ],
      }),
    ]);
  });

  test("selects the opened settings resource in the settings navigation tree", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionsModule());
    workbench.registerModule(createSettingsModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Project" });

    await workbench.resources.openResource(dashboardSettingsResources.repositories, { replaceActive: true });

    expect(workbench.renderers.getTreeState(dashboardSettingsNavigationTreeViewId).selectedNodeId).toBe(
      dashboardSettingsResources.repositories.uri,
    );
  });
});
