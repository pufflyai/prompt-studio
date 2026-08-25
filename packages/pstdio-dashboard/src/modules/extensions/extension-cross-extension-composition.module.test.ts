import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionContributions } from "./extension-contribution-registration";
import { metadata as baseMetadata } from "./module-test-fixtures";

// Composition spans extensions: one extension opens a slot, another contributes a
// panel into it. Contributions register one extension at a time, so this proves the
// external edge still resolves instead of being scoped away with its owner.
const crossExtensionMetadata = {
  ...baseMetadata,
  extensions: [
    { id: "pstdio.planner", name: "planner", displayName: "Planner", sourcePath: "/extensions/planner/extension.ts" },
    {
      id: "pstdio.insights",
      name: "insights",
      displayName: "Insights",
      sourcePath: "/extensions/insights/extension.ts",
    },
  ],
  modes: [
    {
      id: "planner.ticket",
      extensionId: "pstdio.planner",
      modeId: "planner.ticket",
      label: "Ticket",
      panelRegions: ["main", "secondary", "side"],
      resources: {
        "planner.ticket": {
          slots: {
            primary: { region: "main", required: true },
            inspector: { region: "side", allowedRegions: ["side", "secondary"] },
          },
          // An external contribution is optional until a mode names it.
          panels: { "insights.details": { region: "side" } },
        },
      },
    },
  ],
  resourceKinds: [
    {
      id: "planner.ticket",
      extensionId: "pstdio.planner",
      surface: "primary",
      slots: {
        primary: { cardinality: "one", external: false },
        inspector: { cardinality: "many", external: true },
      },
    },
  ],
  panels: [
    {
      id: "planner.editor",
      extensionId: "pstdio.planner",
      show: { for: "planner.ticket", region: "main", required: true },
      title: "Ticket",
      webview: {
        entry: { kind: "package-asset", path: "./editor.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/modules/planner.editor.js",
      },
    },
    {
      id: "insights.details",
      extensionId: "pstdio.insights",
      title: "Insights",
      webview: {
        entry: { kind: "package-asset", path: "./insights.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/modules/insights.details.js",
      },
    },
  ],
  resourcePanels: [
    {
      id: "insights.ticketDetails",
      extensionId: "pstdio.insights",
      resourceKind: "planner.ticket",
      panel: "insights.details",
      slot: "inspector",
    },
  ],
} satisfies DashboardExtensionMetadata;

const withoutNamedPanel = {
  ...crossExtensionMetadata,
  modes: crossExtensionMetadata.modes.map((mode) => ({
    ...mode,
    resources: { "planner.ticket": { slots: mode.resources["planner.ticket"].slots } },
  })),
} satisfies DashboardExtensionMetadata;

const openTicket = async (metadata: DashboardExtensionMetadata) => {
  const workbench = createWorkbenchCore();
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const disposables = registerExtensionContributions({
    ctx: workbench,
    executeCommand: async () => ({ outcome: { ok: true, value: undefined } }) as never,
    metadata,
    projectId: "project-1",
  });
  const resource = { kind: "planner.ticket", uri: "pstdio://ticket/PS-1", id: "PS-1", label: "PS-1" };
  await workbench.navigator.open({
    modeId: "planner.ticket",
    resource,
  });
  const regionOf = (contributionId: string) =>
    Object.values(workbench.layout.getLayout().regions).find((region) =>
      region.widgets.some((placement) => placement.contributionId === contributionId),
    )?.id;
  const placementsOf = (contributionId: string) =>
    Object.values(workbench.layout.getLayout().regions).flatMap((region) =>
      region.widgets.filter((placement) => placement.contributionId === contributionId),
    );
  return { disposables, placementsOf, regionOf, resource, workbench };
};

describe("cross-extension composition", () => {
  test("places a panel one extension contributed into another extension's open slot", async () => {
    const { disposables, placementsOf, regionOf, resource, workbench } = await openTicket(crossExtensionMetadata);

    try {
      expect(regionOf("planner.editor")).toBe("main");
      expect(regionOf("insights.details")).toBe("side");
      expect(placementsOf("planner.editor")).toEqual([
        expect.objectContaining({ resourceUri: resource.uri, closable: false }),
      ]);
      expect(placementsOf("insights.details")).toEqual([
        expect.objectContaining({ resourceUri: resource.uri, closable: true }),
      ]);

      workbench.layout.closePanel(placementsOf("insights.details")[0]!.widgetId);
      await workbench.resources.openResource(resource);
      expect(placementsOf("insights.details")).toEqual([
        expect.objectContaining({ resourceUri: resource.uri, closable: true }),
      ]);
    } finally {
      for (const disposable of disposables) disposable.dispose();
    }
  });

  test("leaves an external contribution unplaced until the mode names it", async () => {
    const { disposables, regionOf } = await openTicket(withoutNamedPanel);

    try {
      expect(regionOf("planner.editor")).toBe("main");
      // Available through Add Panel, but the owner's slot recipe does not place it.
      expect(regionOf("insights.details")).toBeUndefined();
    } finally {
      for (const disposable of disposables) disposable.dispose();
    }
  });
});
