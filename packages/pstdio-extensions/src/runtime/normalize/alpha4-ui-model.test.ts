import { describe, expect, test } from "bun:test";
import {
  defineCommand,
  defineExtension,
  defineMode,
  defineNavigationItem,
  definePage,
  definePlacement,
  defineResourceKind,
  defineTemplateType,
  defineView,
  packageAsset,
  params,
  workbenchModes,
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
  const mode = defineMode({ id: "review", label: "Review", regions: ["main"] });
  const view = defineView({
    id: "tickets",
    title: "Tickets",
    body: { kind: "webview", entry: packageAsset("./views/tickets.tsx", "file:///fake/lab/") },
  });
  const resourceKind = defineResourceKind({ id: "ticket" });
  const page = definePage({
    parent: { extensionId: "pstdio", kind: "page", id: "start" },
    id: "tickets",
    title: "Tickets",
    path: "tickets",
    mode: mode.ref,
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",

        binding: { kind: resourceKind.ref, view: view.ref, cardinality: "one" },
      },
    ],
  });
  return defineExtension({
    modes: [mode],
    pages: [page],
    views: [view],
    resourceKinds: [resourceKind],
    placements: [
      definePlacement({
        id: "tickets.review",
        mode: mode.ref,
        item: { kind: "view", view: view.ref, presence: "fixed" },
        region: "main",
      }),
      definePlacement({
        id: "ticket-primary.review",
        mode: mode.ref,
        item: { kind: "binding", resourceKind: resourceKind.ref, view: view.ref, cardinality: "one" },
        region: "main",
      }),
    ],
    navigationItems: [
      defineNavigationItem({
        id: "tickets",
        owner: workbenchModes.project,
        slot: "content",
        label: "Tickets",
        action: { kind: "page", page: page.ref, resource: { type: "ticket", id: "PS-326" } },
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
    expect(runtime.placements[1]?.contribution.item).toMatchObject({
      kind: "binding",
      view: { extensionId: "pstdio.lab", kind: "view", id: "tickets" },
    });
    expect(runtime.navigationItems[0]?.contribution.action).toEqual({
      kind: "page",
      page: { extensionId: "pstdio.lab", kind: "page", id: "tickets" },
      resource: { type: "ticket", id: "PS-326" },
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
      item: { kind: "view", view: base.views![0]!.ref, presence: "open" },
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

  test("rejects extension panels and mode regions that claim the composed Sidenav", () => {
    const base = alpha4Definition();
    const definition = {
      ...base,
      modes: [{ id: "invalid", ref: { kind: "mode", id: "invalid" }, label: "Invalid", regions: ["sidenav"] }],
      placements: [
        {
          id: "invalid",
          ref: { kind: "placement", id: "invalid" },
          mode: { kind: "mode", id: "invalid" },
          item: { kind: "view", view: base.views![0]!.ref },
          region: "sidenav",
        },
      ],
    } as unknown as LoadedExtensionSource["definition"];

    const runtime = normalizeExtensionSources([source(definition)]);

    expect(runtime.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_mode" }),
        expect.objectContaining({ code: "invalid_placement" }),
      ]),
    );
  });

  test("rejects a placement with a non-callable tab query", () => {
    const base = alpha4Definition();
    const invalidPlacement = {
      ...base.placements![0]!,
      id: "broken-tab",
      ref: { kind: "placement" as const, id: "broken-tab" },
      tab: { query: "not-a-function" },
    };
    const runtime = normalizeExtensionSources([
      source(
        defineExtension({
          ...base,
          placements: [...base.placements!, invalidPlacement] as never,
        }),
      ),
    ]);

    expect(runtime.placements.some((placement) => placement.localId === "broken-tab")).toBe(false);
    expect(runtime.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid_placement" }));
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
