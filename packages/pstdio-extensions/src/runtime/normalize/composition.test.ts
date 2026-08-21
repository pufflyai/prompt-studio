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
      show: { for: "ticket", region: "main", required: true },
      webview: { entry: packageAsset("./editor.tsx", import.meta.url) },
    },
  },
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
      webview: { entry: packageAsset("./insights.tsx", import.meta.url) },
    },
  },
  resourcePanels: {
    insights: { resourceKind: "owner.ticket", panel: "insights", slot: "inspector" },
  },
});

describe("composition normalization", () => {
  // A resource kind's id is the plain name it was declared with, because that same
  // string is the resource type in every payload crossing the extension boundary and in
  // persisted resource URIs. Both spellings of a reference resolve to it.
  test("keeps a declared resource kind id plain and resolves both reference spellings to it", () => {
    const runtime = normalizeExtensionSources([wrap("owner", owner), wrap("addon", addon)]);

    expect(runtime.resourceKinds.map((record) => record.id)).toEqual(["ticket"]);
    expect(runtime.resourcePanels.map((record) => record.resourceKindId)).toEqual(["ticket"]);
    expect(runtime.modes[0]?.contribution.resources).toHaveProperty("ticket");
    expect(runtime.diagnostics).toEqual([]);
  });

  test("emits extension_resource_kind_duplicate when two extensions declare the same kind", () => {
    const rival = defineExtension({
      resourceKinds: {
        ticket: { surface: "attached", slots: { inspector: { cardinality: "many", external: true } } },
      },
    });
    const runtime = normalizeExtensionSources([wrap("owner", owner), wrap("rival", rival)]);

    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_resource_kind_duplicate");
  });

  test("resolves cross-extension edges after collection independent of source order", () => {
    const forward = normalizeExtensionSources([wrap("owner", owner), wrap("addon", addon)]);
    const reverse = normalizeExtensionSources([wrap("addon", addon), wrap("owner", owner)]);

    expect(forward.resourcePanels.map((record) => record.id)).toEqual(["addon.insights"]);
    expect(reverse.resourcePanels.map((record) => record.id)).toEqual(["addon.insights"]);
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
    expect(runtime.resourceKinds.map((record) => record.id)).toEqual(["ticket"]);
    // The invalid optional edge is dropped; the valid edges keep composing.
    expect(runtime.resourcePanels.map((record) => record.id)).toEqual(["addon.insights"]);
  });

  test("emits extension_panel_placement_unresolvable when a mode places a panel outside its declaration", () => {
    const invalidMode = defineExtension({
      ...owner,
      modes: {
        project: {
          label: "Project",
          resources: {
            ticket: {
              slots: { primary: { region: "main", required: true } },
              panels: { editor: { region: "side" } },
            },
          },
        },
      },
    });
    const runtime = normalizeExtensionSources([wrap("owner", invalidMode), wrap("addon", addon)]);

    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "extension_panel_placement_unresolvable",
    );
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
      panels: {
        editor: {
          ...owner.panels!.editor!,
          show: { for: "ticket", region: "side" },
        },
      },
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

  test("treats a contribution to an extension that is not installed as inert, not an error", () => {
    // The addon alone: its edge targets owner.ticket, which is not present.
    const runtime = normalizeExtensionSources([wrap("addon", addon)]);

    expect(runtime.diagnostics.map((diagnostic) => diagnostic.severity)).toEqual(["warning"]);
    expect(runtime.diagnostics[0]).toMatchObject({ code: "extension_resource_kind_missing" });
    // The panel itself still registers, so the extension installs and stays usable.
    expect(runtime.panels.map((panel) => panel.id)).toEqual(["addon.insights"]);
  });

  test("keeps a dangling reference inside an installed extension an error", () => {
    const broken = defineExtension({
      ...owner,
      resourcePanels: { editor: { resourceKind: "missing-local-kind", panel: "editor", slot: "primary" } },
    });
    const runtime = normalizeExtensionSources([wrap("owner", broken)]);

    expect(runtime.diagnostics.map((diagnostic) => diagnostic.severity)).toContain("error");
  });
});
