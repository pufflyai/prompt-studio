import { describe, expect, test } from "bun:test";
import { resolveComposition } from "./composition-resolver";
import type { ResolveCompositionInput, WorkbenchComposition } from "./composition-resolver-types";

const composition: WorkbenchComposition = {
  resourceKinds: [
    {
      id: "planner.ticket",
      extensionId: "pstdio.planner",
      surface: "primary",
      slots: {
        primary: { cardinality: "one", external: false },
        navigation: { cardinality: "one", external: true },
        inspector: { cardinality: "many", external: true },
      },
    },
  ],
  panels: [
    {
      id: "planner.editor",
      extensionId: "pstdio.planner",
      title: "Editor",
      show: { resourceKind: "planner.ticket", region: "main", required: true },
    },
    {
      id: "planner.tree",
      extensionId: "pstdio.planner",
      title: "Tree",
      show: { resourceKind: "planner.ticket", region: "sidenav", required: true },
    },
    {
      id: "planner.properties",
      extensionId: "pstdio.planner",
      title: "Properties",
      show: { resourceKind: "planner.ticket", region: "side", allowedRegions: ["side", "secondary"] },
    },
    { id: "acme.insights", extensionId: "acme.insights", title: "Insights" },
  ],
  resourcePanels: [
    {
      id: "acme.insights",
      extensionId: "acme.insights",
      resourceKind: "planner.ticket",
      panel: "acme.insights",
      slot: "inspector",
    },
  ],
};

const ticketMode = {
  id: "planner.ticket-mode",
  resources: {
    "planner.ticket": {
      slots: {
        primary: { region: "main" as const, required: true },
        navigation: { region: "sidenav" as const, required: true },
        inspector: { region: "side" as const, allowedRegions: ["side", "secondary"] as const },
      },
    },
  },
};

const resolve = (input: Partial<ResolveCompositionInput>) =>
  resolveComposition({
    context: { modeId: ticketMode.id, resourceKind: "planner.ticket" },
    mode: ticketMode,
    composition,
    ...input,
  });

describe("composition resolver", () => {
  test("seeds recipe placements in declaration order for a new scope", () => {
    const result = resolve({});

    expect(result.diagnostics).toEqual([]);
    expect(result.regionOrder.main).toEqual(["planner.editor"]);
    expect(result.regionOrder.sidenav).toEqual(["planner.tree"]);
    expect(result.regionOrder.side).toEqual(["planner.properties"]);
    expect(result.placements.find((placement) => placement.panelId === "planner.editor")).toMatchObject({
      required: true,
    });
    // An external contribution stays available through Add Panel until a mode names it.
    expect(result.addablePanels.map((panel) => panel.panelId)).toEqual(["acme.insights"]);
  });

  test("rejects a context whose mode does not accept the resource kind without resolving placements", () => {
    const result = resolve({ context: { modeId: ticketMode.id, resourceKind: "acme.blend" } });

    expect(result.placements).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["extension_mode_resource_unsupported"]);
  });

  const ticketModeWithInsights = {
    ...ticketMode,
    resources: {
      "planner.ticket": {
        slots: ticketMode.resources["planner.ticket"].slots,
        // A mode may name an external contribution to place it by default.
        panels: { "acme.insights": { region: "side" as const, allowedRegions: ["side", "secondary"] as const } },
      },
    },
  };

  test("persisted tab order wins over declaration order", () => {
    const result = resolve({
      mode: ticketModeWithInsights,
      persisted: {
        regions: {
          main: { order: ["planner.editor"], activePanelId: "planner.editor" },
          sidenav: { order: ["planner.tree"] },
          side: { order: ["acme.insights", "planner.properties"], activePanelId: "acme.insights" },
        },
      },
    });

    expect(result.regionOrder.side).toEqual(["acme.insights", "planner.properties"]);
    expect(result.activePanelIds.side).toBe("acme.insights");
  });

  test("keeps a valid persisted user move and drops a disallowed one", () => {
    const result = resolve({
      mode: ticketModeWithInsights,
      persisted: {
        regions: {
          main: { order: ["planner.editor"] },
          sidenav: { order: ["planner.tree"] },
          secondary: { order: ["planner.properties"] },
          side: { order: ["acme.insights"] },
        },
      },
    });

    // side/secondary are both allowed for the inspector slot, so the move survives.
    expect(result.regionOrder.secondary).toEqual(["planner.properties"]);
    expect(result.regionOrder.side).toEqual(["acme.insights"]);
  });

  test("restores a missing required placement without reopening closed optional panels", () => {
    const result = resolve({
      persisted: {
        regions: {
          sidenav: { order: ["planner.tree"] },
          side: { order: [] },
        },
      },
    });

    // The user closed both inspectors; only the required editor and tree survive.
    expect(result.regionOrder.main).toEqual(["planner.editor"]);
    expect(result.placements.find((placement) => placement.panelId === "planner.editor")?.origin).toBe("required");
    expect(result.regionOrder.side ?? []).toEqual([]);
    expect(result.addablePanels.map((panel) => panel.panelId)).toEqual(["planner.properties", "acme.insights"]);
  });

  test("omits invalid optional contributions and reports them without blocking valid panels", () => {
    const withInvalid: WorkbenchComposition = {
      ...composition,
      resourcePanels: [
        ...composition.resourcePanels,
        {
          id: "acme.ghost",
          extensionId: "acme.insights",
          resourceKind: "planner.ticket",
          panel: "acme.ghost",
          slot: "inspector",
        },
        {
          id: "acme.stow",
          extensionId: "acme.insights",
          resourceKind: "planner.ticket",
          panel: "acme.insights",
          slot: "missing",
        },
      ],
    };
    const result = resolve({ composition: withInvalid });

    expect(result.diagnostics.map((diagnostic) => diagnostic.code).sort()).toEqual([
      "extension_panel_missing",
      "extension_resource_slot_missing",
    ]);
    expect(result.regionOrder.main).toEqual(["planner.editor"]);
    expect(result.regionOrder.side).toEqual(["planner.properties"]);
  });

  test("rejects an external contribution to a closed slot", () => {
    const withClosed: WorkbenchComposition = {
      ...composition,
      resourcePanels: [
        ...composition.resourcePanels,
        {
          id: "acme.takeover",
          extensionId: "acme.insights",
          resourceKind: "planner.ticket",
          panel: "acme.insights",
          slot: "primary",
        },
      ],
    };
    const result = resolve({ composition: withClosed });

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_resource_slot_closed");
    expect(result.regionOrder.main).toEqual(["planner.editor"]);
  });

  test("a known-panel entry wins over its slot placement", () => {
    const result = resolve({
      mode: {
        id: ticketMode.id,
        resources: {
          "planner.ticket": {
            slots: ticketMode.resources["planner.ticket"].slots,
            panels: { "acme.insights": { region: "secondary" as const } },
          },
        },
      },
    });

    expect(result.regionOrder.secondary).toEqual(["acme.insights"]);
    expect(result.regionOrder.side).toEqual(["planner.properties"]);
  });

  test("reports an unsupported region and keeps a safe main fallback for required placements", () => {
    const result = resolve({
      mode: {
        id: ticketMode.id,
        resources: {
          "planner.ticket": {
            panels: { "planner.editor": { region: "sidenav" as const, required: true } },
          },
        },
      },
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_panel_placement_unresolvable");
    expect(result.requiredFallback).toEqual({ panelId: "planner.editor" });
  });

  test("required on a cardinality-many slot is invalid and treated as optional", () => {
    const result = resolve({
      mode: {
        id: ticketMode.id,
        resources: {
          "planner.ticket": {
            slots: {
              primary: { region: "main" as const, required: true },
              inspector: { region: "side" as const, required: true },
            },
          },
        },
      },
      persisted: { regions: { main: { order: ["planner.editor"] }, side: { order: [] } } },
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_placement_required_invalid");
    // The invalid required flag does not force the closed inspectors back open.
    expect(result.regionOrder.side ?? []).toEqual([]);
  });

  test("places mode-wide panels without a resource", () => {
    const result = resolveComposition({
      context: { modeId: "lab" },
      mode: { id: "lab", modePanels: { "planner.tree": { region: "sidenav", required: true } } },
      composition,
    });

    expect(result.regionOrder.sidenav).toEqual(["planner.tree"]);
    expect(result.placements[0]).toMatchObject({ required: true });
  });

  test("one resource resolves a distinct layout in each compatible mode", () => {
    const animation = {
      id: "lab.animation",
      resources: {
        "planner.ticket": {
          panels: {
            "planner.tree": { region: "sidenav" as const, required: true },
            "planner.properties": { region: "side" as const },
          },
        },
      },
    };
    const sculpt = {
      id: "lab.sculpt",
      resources: {
        "planner.ticket": {
          panels: {
            "planner.tree": { region: "side" as const, required: true },
            "planner.properties": { region: "secondary" as const },
          },
        },
      },
    };

    const movable: WorkbenchComposition = {
      ...composition,
      panels: composition.panels.map((panel) =>
        panel.id === "planner.tree"
          ? {
              ...panel,
              show: {
                resourceKind: "planner.ticket",
                region: "sidenav",
                allowedRegions: ["sidenav", "side"],
                required: true,
              },
            }
          : panel,
      ),
    };
    const first = resolve({
      context: { modeId: animation.id, resourceKind: "planner.ticket" },
      mode: animation,
      composition: movable,
    });
    const second = resolve({
      context: { modeId: sculpt.id, resourceKind: "planner.ticket" },
      mode: sculpt,
      composition: movable,
    });

    expect(first.diagnostics).toEqual([]);
    expect(second.diagnostics).toEqual([]);
    // The resource keeps its primary location while its supporting panels move.
    expect(first.regionOrder.main).toEqual(["planner.editor"]);
    expect(second.regionOrder.main).toEqual(["planner.editor"]);
    expect(first.regionOrder.sidenav).toEqual(["planner.tree"]);
    expect(second.regionOrder.side).toEqual(["planner.tree"]);
    expect(first.regionOrder.side).toEqual(["planner.properties"]);
    expect(second.regionOrder.secondary).toEqual(["planner.properties"]);
  });

  test("an external contribution is optional until the mode names it", () => {
    const bySlot = resolve({});
    const byName = resolve({ mode: ticketModeWithInsights });

    // The slot recipe places only the resource owner's panels.
    expect(bySlot.regionOrder.side).toEqual(["planner.properties"]);
    expect(bySlot.addablePanels.map((panel) => panel.panelId)).toEqual(["acme.insights"]);
    // Naming the external panel in the recipe places it.
    expect(byName.regionOrder.side).toEqual(["planner.properties", "acme.insights"]);
    expect(byName.addablePanels).toEqual([]);
  });
});

describe("composition Add Panel options", () => {
  test("offers a closed optional mode panel", () => {
    const mode = {
      id: "lab",
      modePanels: {
        "planner.editor": { region: "main" as const },
      },
    };
    const result = resolve({
      context: { modeId: mode.id },
      mode,
      persisted: { regions: { main: { order: [] } } },
    });

    expect(result.addablePanels.map((panel) => panel.panelId)).toEqual(["planner.editor"]);
    expect(result.addablePanels).toEqual([{ panelId: "planner.editor", region: "main", allowedRegions: ["main"] }]);
  });

  test("keeps default-closed panels out of the initial layout and preserves their pinned policy", () => {
    const mode = {
      id: "lab",
      modePanels: {
        "planner.editor": { region: "main" as const, defaultOpen: false, pinned: true },
      },
    };

    const result = resolve({ context: { modeId: mode.id }, mode });

    expect(result.placements).toEqual([]);
    expect(result.addablePanels).toEqual([
      { panelId: "planner.editor", region: "main", allowedRegions: ["main"], pinned: true },
    ]);
  });
});

describe("panel-owned composition placement", () => {
  const panelOwnedComposition = {
    resourceKinds: [
      {
        id: "planner.ticket",
        extensionId: "pstdio.planner",
        surface: "primary",
        slots: { inspector: { cardinality: "many", external: true } },
      },
    ],
    panels: [
      {
        id: "planner.editor",
        extensionId: "pstdio.planner",
        title: "Editor",
        show: {
          resourceKind: "planner.ticket",
          region: "main",
          allowedRegions: ["main", "secondary"],
          required: true,
        },
      },
      {
        id: "planner.properties",
        extensionId: "pstdio.planner",
        title: "Properties",
        show: { resourceKind: "planner.ticket", region: "side" },
      },
    ],
    resourcePanels: [],
  } as unknown as WorkbenchComposition;

  test("places panels for the owner's resource without resource-panel edges", () => {
    const mode = {
      id: "planner.mode",
      extensionId: "pstdio.planner",
      resources: { "planner.ticket": {} },
    };
    const result = resolveComposition({
      context: { modeId: mode.id, resourceKind: "planner.ticket" },
      mode,
      composition: panelOwnedComposition,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.regionOrder.main).toEqual(["planner.editor"]);
    expect(result.regionOrder.side).toEqual(["planner.properties"]);
    expect(result.placements.find((placement) => placement.panelId === "planner.editor")?.required).toBe(true);
  });

  test("lets a mode move a panel only within the panel's allowed regions", () => {
    const validMode = {
      id: "planner.review",
      extensionId: "pstdio.planner",
      resources: {
        "planner.ticket": { panels: { "planner.editor": { region: "secondary" as const } } },
      },
    };
    const invalidMode = {
      ...validMode,
      id: "planner.side",
      resources: {
        "planner.ticket": { panels: { "planner.editor": { region: "side" as const } } },
      },
    };

    const valid = resolveComposition({
      context: { modeId: validMode.id, resourceKind: "planner.ticket" },
      mode: validMode,
      composition: panelOwnedComposition,
    });
    const invalid = resolveComposition({
      context: { modeId: invalidMode.id, resourceKind: "planner.ticket" },
      mode: invalidMode,
      composition: panelOwnedComposition,
    });

    expect(valid.regionOrder.secondary).toEqual(["planner.editor"]);
    expect(invalid.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "extension_panel_placement_unresolvable",
    );
    expect(invalid.placements.some((placement) => placement.panelId === "planner.editor")).toBe(false);
  });
});
