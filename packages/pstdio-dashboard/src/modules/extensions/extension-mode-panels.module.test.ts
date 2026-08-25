import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { selectDashboardProject } from "@/shared/app/project-context";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionContributions } from "./extension-contribution-registration";
import { metadata as baseMetadata } from "./module-test-fixtures";

const webview = (path: string) => ({
  entry: { kind: "package-asset" as const, path, baseUrl: "file:///extension/extension.ts" },
  runtimeUrl: "/v1/extensions/runtime",
  moduleUrl: `/modules/${path}.js`,
});

// A mode-wide panel does not consume the active resource. A mode that also arranges a
// resource kind must still place its mode-wide panels when no such resource is open.
const labMetadata = {
  ...baseMetadata,
  extensions: [
    {
      id: "pstdio.extension-lab",
      name: "extension-lab",
      displayName: "Lab",
      sourcePath: "/extensions/lab/extension.ts",
    },
  ],
  modes: [
    {
      id: "extension-lab.lab",
      extensionId: "pstdio.extension-lab",
      modeId: "pstdio.extension-lab.lab",
      label: "Lab",
      panelRegions: ["main", "side"],
      resources: {
        "glass-lab-artifact": {},
      },
    },
  ],
  resourceKinds: [
    {
      id: "glass-lab-artifact",
      extensionId: "pstdio.extension-lab",
      surface: "attached",
      slots: { inspector: { cardinality: "many", external: true } },
    },
  ],
  panels: [
    {
      id: "extension-lab.labOverview",
      extensionId: "pstdio.extension-lab",
      show: { region: "main", required: true },
      title: "Overview",
      webview: webview("overview"),
    },
    {
      id: "extension-lab.labCams",
      extensionId: "pstdio.extension-lab",
      show: { region: "main" },
      title: "Cams",
      webview: webview("cams"),
      panelMenus: [
        {
          id: "extension-lab.labCams.cameras",
          extensionId: "pstdio.extension-lab",
          ownerPanelId: "extension-lab.labCams",
          title: "Cameras",
          side: "left",
          renderer: { kind: "tree", id: "extension-lab.labCams" },
        },
      ],
    },
    {
      id: "extension-lab.labArtifacts",
      extensionId: "pstdio.extension-lab",
      show: { region: "main" },
      title: "Artifacts",
      renderer: { kind: "dataTable", id: "extension-lab.glassLabArtifacts" },
      panelMenus: [
        {
          id: "extension-lab.labArtifacts.create",
          extensionId: "pstdio.extension-lab",
          ownerPanelId: "extension-lab.labArtifacts",
          title: "Create artifacts",
          side: "right",
          renderer: { kind: "controls", id: "extension-lab.labArtifactCreate" },
        },
      ],
    },
    {
      id: "extension-lab.labArtifactDetail",
      extensionId: "pstdio.extension-lab",
      show: { for: "glass-lab-artifact", region: "side" },
      title: "Artifact",
      webview: webview("artifact"),
    },
  ],
  dataTableRenderers: [
    {
      id: "extension-lab.glassLabArtifacts",
      extensionId: "pstdio.extension-lab",
      title: "Artifacts",
      resourceKind: "glass-lab-artifact",
      queryHandlerId: "extension-lab.glass-lab-artifacts.query",
    },
  ],
  resourcePanels: [],
} satisfies DashboardExtensionMetadata;

describe("extension mode-wide panels", () => {
  test("places mode-wide panels when the mode is entered without a resource", async () => {
    const workbench = createWorkbenchCore();
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposables = registerExtensionContributions({
      ctx: workbench,
      executeCommand: async () => ({ outcome: { ok: true, value: undefined } }) as never,
      metadata: labMetadata,
      projectId: "project-1",
    });

    try {
      await workbench.navigator.open({ modeId: "pstdio.extension-lab.lab" });

      expect(workbench.layout.getLayout().regions.main.widgets.map((placement) => placement.contributionId)).toEqual([
        "extension-lab.labOverview",
        "extension-lab.labCams",
        "extension-lab.labArtifacts",
      ]);
    } finally {
      for (const disposable of disposables) disposable.dispose();
    }
  });

  test("offers a closed optional mode panel through the active mode", async () => {
    const workbench = createWorkbenchCore();
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposables = registerExtensionContributions({
      ctx: workbench,
      executeCommand: async () => ({ outcome: { ok: true, value: undefined } }) as never,
      metadata: labMetadata,
      projectId: "project-1",
    });

    try {
      await workbench.navigator.open({ modeId: "pstdio.extension-lab.lab" });
      const artifacts = workbench.layout
        .getLayout()
        .regions.main.widgets.find((placement) => placement.contributionId === "extension-lab.labArtifacts")!;
      workbench.layout.closeWidget(artifacts.widgetId);

      expect(
        workbench.modes.getMode("pstdio.extension-lab.lab")?.listAddablePanels?.({
          layout: workbench.layout.getLayout(),
          resource: workbench.getPrimaryResource(),
        }),
      ).toContainEqual({ panelId: "extension-lab.labArtifacts", region: "main", allowedRegions: ["main"] });
    } finally {
      for (const disposable of disposables) disposable.dispose();
    }
  });

  test("places mode-wide panels when switching from an incompatible resource", async () => {
    const workbench = createWorkbenchCore();
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "extension-view", label: "Extension view" });
    const disposables = registerExtensionContributions({
      ctx: workbench,
      executeCommand: async () => ({ outcome: { ok: true, value: undefined } }) as never,
      metadata: labMetadata,
      projectId: "project-1",
    });

    try {
      // A collection view is active first, exactly as the Tickets board is in the app.
      selectDashboardNavigationResource(workbench, {
        kind: "extension-view",
        uri: "dashboard-workbench://project/project-1/extension-views/planner.tickets",
        id: "planner.tickets",
        label: "Tickets",
      });
      // The Lab tree item switches mode through the workbench command.
      await workbench.commands.executeCommand("workbench.action.switchMode", {
        modeId: "pstdio.extension-lab.lab",
      });

      expect(workbench.modes.getActiveModeId()).toBe("pstdio.extension-lab.lab");
      expect(workbench.layout.getLayout().regions.main.widgets.map((placement) => placement.contributionId)).toEqual([
        "extension-lab.labOverview",
        "extension-lab.labCams",
        "extension-lab.labArtifacts",
      ]);
    } finally {
      for (const disposable of disposables) disposable.dispose();
    }
  });
});
