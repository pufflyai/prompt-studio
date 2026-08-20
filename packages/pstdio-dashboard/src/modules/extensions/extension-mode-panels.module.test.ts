import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
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
      modePanels: {
        "extension-lab.labOverview": { region: "main", required: true },
        "extension-lab.labCams": { region: "main" },
      },
      resources: {
        "extension-lab.glass-lab-artifact": { slots: { inspector: { region: "side" } } },
      },
    },
  ],
  resourceKinds: [
    {
      id: "extension-lab.glass-lab-artifact",
      extensionId: "pstdio.extension-lab",
      surface: "attached",
      slots: { inspector: { cardinality: "many", external: true } },
    },
  ],
  panels: [
    {
      id: "extension-lab.labOverview",
      extensionId: "pstdio.extension-lab",
      supportedRegions: ["main"],
      title: "Overview",
      webview: webview("overview"),
    },
    {
      id: "extension-lab.labCams",
      extensionId: "pstdio.extension-lab",
      supportedRegions: ["main", "side"],
      title: "Cams",
      webview: webview("cams"),
    },
    {
      id: "extension-lab.labArtifactDetail",
      extensionId: "pstdio.extension-lab",
      supportedRegions: ["side"],
      title: "Artifact",
      webview: webview("artifact"),
    },
  ],
  resourcePanels: [
    {
      id: "extension-lab.labArtifactDetail",
      extensionId: "pstdio.extension-lab",
      resourceKind: "extension-lab.glass-lab-artifact",
      panel: "extension-lab.labArtifactDetail",
      slot: "inspector",
    },
  ],
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
        "dashboard-workbench.extension-view.extension-lab.labOverview",
        "dashboard-workbench.extension-view.extension-lab.labCams",
      ]);
    } finally {
      for (const disposable of disposables) disposable.dispose();
    }
  });
});
