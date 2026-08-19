import { describe, expect, test } from "bun:test";
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const wrap = (name: string, definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `pstdio.${name}`,
    name,
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^1.0.0",
  },
  definition,
});

const owner = defineExtension({
  resourceKinds: {
    ticket: {
      surface: "primary",
      slots: {
        primary: { cardinality: "one", external: false },
        inspector: { cardinality: "many", external: true },
      },
    },
  },
  panels: {
    editor: {
      title: "Editor",
      supportedRegions: ["main"],
      webview: { entry: packageAsset("./editor.tsx", import.meta.url) },
    },
  },
  resourcePanels: { editor: { resourceKind: "ticket", panel: "editor", slot: "primary" } },
  modes: {
    project: {
      label: "Project",
      resources: { ticket: { slots: { primary: { region: "main", required: true } } } },
    },
  },
});

const addon = defineExtension({
  panels: {
    insights: {
      title: "Insights",
      supportedRegions: ["side", "secondary"],
      webview: { entry: packageAsset("./insights.tsx", import.meta.url) },
    },
  },
  resourcePanels: {
    insights: { resourceKind: "owner.ticket", panel: "insights", slot: "inspector" },
  },
});

describe("composition normalization", () => {
  test("resolves cross-extension edges after collection independent of source order", () => {
    const forward = normalizeExtensionSources([wrap("owner", owner), wrap("addon", addon)]);
    const reverse = normalizeExtensionSources([wrap("addon", addon), wrap("owner", owner)]);

    expect(forward.resourcePanels.map((record) => record.id)).toEqual(["owner.editor", "addon.insights"]);
    expect(reverse.resourcePanels.map((record) => record.id)).toEqual(["addon.insights", "owner.editor"]);
    expect(forward.diagnostics).toEqual([]);
    expect(reverse.diagnostics).toEqual([]);
  });

  test.each([
    ["extension_resource_kind_missing", { resourceKind: "missing.ticket", panel: "insights", slot: "inspector" }],
    ["extension_panel_missing", { resourceKind: "owner.ticket", panel: "missing.panel", slot: "inspector" }],
    ["extension_resource_slot_missing", { resourceKind: "owner.ticket", panel: "insights", slot: "missing" }],
    ["extension_resource_slot_closed", { resourceKind: "owner.ticket", panel: "insights", slot: "primary" }],
  ])("emits %s without removing valid records", (code, edge) => {
    const invalid = defineExtension({
      ...addon,
      resourcePanels: { ...addon.resourcePanels, invalid: edge },
    });
    const runtime = normalizeExtensionSources([wrap("owner", owner), wrap("addon", invalid)]);

    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
    expect(runtime.resourceKinds.map((record) => record.id)).toEqual(["owner.ticket"]);
    // The invalid optional edge is dropped; the valid edges keep composing.
    expect(runtime.resourcePanels.map((record) => record.id)).toEqual(["owner.editor", "addon.insights"]);
  });

  test("emits extension_panel_region_unsupported when a mode places a panel outside its regions", () => {
    const invalidMode = defineExtension({
      ...owner,
      modes: {
        project: {
          label: "Project",
          resources: {
            ticket: {
              slots: { primary: { region: "main", required: true } },
              panels: { "addon.insights": { region: "main" } },
            },
          },
        },
      },
    });
    const runtime = normalizeExtensionSources([wrap("owner", invalidMode), wrap("addon", addon)]);

    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_panel_region_unsupported");
  });

  test("emits extension_mode_resource_unsupported for a recipe naming an unknown resource kind", () => {
    const invalidMode = defineExtension({
      ...owner,
      modes: {
        project: {
          label: "Project",
          resources: {
            "missing.kind": { slots: { primary: { region: "main" } } },
            ticket: { slots: { primary: { region: "main", required: true } } },
          },
        },
      },
    });
    const runtime = normalizeExtensionSources([wrap("owner", invalidMode)]);

    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_mode_resource_unsupported");
  });

  test("emits extension_placement_required_invalid for required on a cardinality-many slot", () => {
    const invalidMode = defineExtension({
      ...owner,
      modes: {
        project: {
          label: "Project",
          resources: {
            ticket: {
              slots: {
                primary: { region: "main", required: true },
                inspector: { region: "side", required: true },
              },
            },
          },
        },
      },
    });
    const runtime = normalizeExtensionSources([wrap("owner", invalidMode)]);

    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_placement_required_invalid");
  });

  test("emits extension_resource_primary_invalid when a primary recipe has no main placement", () => {
    const invalidMode = defineExtension({
      ...owner,
      modes: {
        project: {
          label: "Project",
          resources: {
            ticket: { slots: { primary: { region: "side" } } },
          },
        },
      },
    });
    const runtime = normalizeExtensionSources([wrap("owner", invalidMode)]);

    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_resource_primary_invalid");
  });

  test("emits extension_resource_primary_invalid for a primary kind without a single-cardinality primary slot", () => {
    const invalidKind = defineExtension({
      resourceKinds: {
        broken: {
          surface: "primary",
          slots: { inspector: { cardinality: "many", external: true } },
        },
      },
    });
    const runtime = normalizeExtensionSources([wrap("owner", invalidKind)]);

    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_resource_primary_invalid");
  });

  test("normalizes hierarchy providers and rejects unknown resource kinds", () => {
    const withProvider = defineExtension({
      ...owner,
      resourceHierarchyProviders: {
        ticket: { resourceKind: "ticket", parent: () => null },
        dangling: { resourceKind: "missing.kind", parent: () => null },
      },
    });
    const runtime = normalizeExtensionSources([wrap("owner", withProvider)]);

    expect(runtime.resourceHierarchyProviders.map((record) => record.id)).toEqual(["owner.ticket", "owner.dangling"]);
    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_resource_kind_missing");
  });
});
