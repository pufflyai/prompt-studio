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

const pageDefinition = () => {
  const mode = defineMode({ id: "review", label: "Review" });
  const view = defineView({
    id: "tickets",
    title: "Tickets",
    body: { kind: "webview", entry: packageAsset("./views/tickets.tsx", "file:///fake/lab/") },
  });
  const editor = defineView({
    id: "ticket-editor",
    title: "Ticket",
    body: { kind: "webview", entry: packageAsset("./views/editor.tsx", "file:///fake/lab/") },
  });
  const resourceKind = defineResourceKind({ id: "ticket" });
  const page = definePage({
    id: "tickets",
    title: "Tickets",
    path: "tickets",
    slots: [
      { id: "board", region: "main", view: view.ref, closable: false },
      { id: "ticket", region: "main", cardinality: "many" },
    ],
    bindings: [{ resourceKind: resourceKind.ref, view: editor.ref, slot: "ticket" }],
  });
  return defineExtension({
    modes: [mode],
    views: [view, editor],
    resourceKinds: [resourceKind],
    pages: [page],
    placements: [
      definePlacement({
        id: "tickets.review",
        mode: mode.ref,
        item: { kind: "view", view: view.ref },
        region: "main",
        required: true,
      }),
    ],
    navigationItems: [
      defineNavigationItem({
        id: "tickets",
        slot: workbenchSlots.projectNavigation,
        label: "Tickets",
        action: { kind: "page", page: page.ref },
      }),
    ],
  });
};

describe("page UI normalization", () => {
  test("normalizes views, pages, placements, and navigation with typed ownership", () => {
    const runtime = normalizeExtensionSources([source(pageDefinition())]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.views[0]).toMatchObject({
      id: "pstdio.lab.view.tickets",
      localId: "tickets",
      contribution: { ref: { extensionId: "pstdio.lab", kind: "view", id: "tickets" } },
    });
    expect(runtime.placements).toHaveLength(1);
    expect(runtime.pages[0]).toMatchObject({
      id: "pstdio.lab.page.tickets",
      localId: "tickets",
      contribution: {
        path: "tickets",
        bindings: [
          {
            resourceKind: { extensionId: "pstdio.lab", kind: "resource-kind", id: "ticket" },
            view: { extensionId: "pstdio.lab", kind: "view", id: "ticket-editor" },
            slot: "ticket",
          },
        ],
      },
    });
    expect(runtime.navigationItems[0]?.contribution.action).toEqual({
      kind: "page",
      page: { extensionId: "pstdio.lab", kind: "page", id: "tickets" },
    });
  });

  test("rejects removed source collections instead of adapting them", () => {
    const definition = { ...pageDefinition(), panels: [] } as unknown as LoadedExtensionSource["definition"];
    const runtime = normalizeExtensionSources([source(definition)]);

    expect(runtime.views).toEqual([]);
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({ code: "removed_extension_contribution", metadata: { key: "panels" } }),
    );
  });

  test("rejects removed resource-view contributions and names the replacement", () => {
    const definition = {
      ...pageDefinition(),
      resourceViews: [],
    } as unknown as LoadedExtensionSource["definition"];
    const runtime = normalizeExtensionSources([source(definition)]);

    expect(runtime.views).toEqual([]);
    const diagnostic = runtime.diagnostics.find(
      (candidate) => candidate.code === "removed_extension_contribution" && candidate.metadata?.key === "resourceViews",
    );
    expect(diagnostic?.message).toContain("bindings");
  });

  test("rejects duplicate local ids and invalid placement rules", () => {
    const base = pageDefinition();
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
