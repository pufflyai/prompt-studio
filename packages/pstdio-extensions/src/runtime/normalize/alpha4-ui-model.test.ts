import { describe, expect, test } from "bun:test";
import {
  defineCommand,
  defineExtension,
  defineMode,
  defineNavigationItem,
  definePlacement,
  defineResourceKind,
  defineResourceView,
  defineTemplateType,
  defineView,
  packageAsset,
  params,
  resourceSlotRef,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const source = (definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  packagePath: "/fake/lab",
  sourcePath: "/fake/lab/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: "pstdio.lab",
    name: "lab",
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: EXTENSION_API_VERSION,
  },
  definition,
});

const alpha4Definition = () => {
  const mode = defineMode({ id: "review", label: "Review" });
  const view = defineView({
    id: "tickets",
    title: "Tickets",
    path: "tickets",
    body: { kind: "webview", entry: packageAsset("./views/tickets.tsx", "file:///fake/lab/") },
  });
  const resourceKind = defineResourceKind({
    id: "ticket",
    surface: "primary",
    slots: [{ id: "primary", cardinality: "one", access: "owner" }],
  });
  const primary = resourceSlotRef(resourceKind.ref, "primary");
  return defineExtension({
    modes: [mode],
    views: [view],
    resourceKinds: [resourceKind],
    resourceViews: [
      defineResourceView({ id: "ticket-editor", resourceKind: resourceKind.ref, slot: primary, view: view.ref }),
    ],
    placements: [
      definePlacement({
        id: "tickets.review",
        mode: mode.ref,
        item: { kind: "view", view: view.ref },
        region: "main",
        required: true,
      }),
      definePlacement({
        id: "ticket-primary.review",
        mode: mode.ref,
        item: { kind: "resource-slot", slot: primary },
        region: "main",
      }),
    ],
    navigationItems: [
      defineNavigationItem({
        id: "tickets",
        slot: workbenchSlots.projectNavigation,
        label: "Tickets",
        action: { kind: "view", view: view.ref },
      }),
    ],
  });
};

describe("alpha.4 UI normalization", () => {
  test("normalizes views, placements, resource bindings, and navigation with typed ownership", () => {
    const runtime = normalizeExtensionSources([source(alpha4Definition())]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.views[0]).toMatchObject({
      id: "pstdio.lab.view.tickets",
      localId: "tickets",
      contribution: { ref: { extensionId: "pstdio.lab", kind: "view", id: "tickets" } },
    });
    expect(runtime.placements).toHaveLength(2);
    expect(runtime.resourceViews[0]?.contribution).toMatchObject({
      view: { extensionId: "pstdio.lab", kind: "view", id: "tickets" },
    });
    expect(runtime.navigationItems[0]?.contribution.action).toEqual({
      kind: "view",
      view: { extensionId: "pstdio.lab", kind: "view", id: "tickets" },
    });
  });

  test("rejects removed source collections instead of adapting them", () => {
    const definition = { ...alpha4Definition(), panels: [] } as unknown as LoadedExtensionSource["definition"];
    const runtime = normalizeExtensionSources([source(definition)]);

    expect(runtime.views).toEqual([]);
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({ code: "removed_extension_contribution", metadata: { key: "panels" } }),
    );
  });

  test("rejects duplicate local ids and invalid placement rules", () => {
    const base = alpha4Definition();
    const duplicate = defineView({
      id: "tickets",
      title: "Duplicate",
      body: { kind: "webview", entry: packageAsset("./views/duplicate.tsx", "file:///fake/lab/") },
    });
    const invalidPlacement = definePlacement({
      id: "invalid",
      mode: base.modes![0]!.ref,
      item: { kind: "view", view: base.views![0]!.ref },
      region: "side",
      movableTo: ["main"],
    });
    const runtime = normalizeExtensionSources([
      source(
        defineExtension({
          ...base,
          views: [...base.views!, duplicate],
          placements: [...base.placements!, invalidPlacement],
        }),
      ),
    ]);

    expect(runtime.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_contribution_id" }),
        expect.objectContaining({ code: "invalid_placement" }),
      ]),
    );
  });

  test("qualifies template parameter types with their owning extension", () => {
    const templateType = defineTemplateType({ id: "ticket", label: "Ticket" });
    const command = defineCommand({
      id: "refine",
      title: "Refine",
      params: { template: params.template({ type: "ticket" }) },
      run: async () => undefined,
    });
    const runtime = normalizeExtensionSources([
      source(defineExtension({ commands: [command], templateTypes: [templateType] })),
    ]);

    expect(runtime.commands[0]?.params.template).toMatchObject({
      type: "template",
      templateType: "pstdio.lab.template-type.ticket",
    });
  });
});
