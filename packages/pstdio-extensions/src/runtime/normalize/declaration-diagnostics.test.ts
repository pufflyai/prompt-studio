import { expect, test } from "bun:test";
import {
  defineExtension,
  defineMode,
  definePage,
  definePlacement,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const view = defineView({
  id: "editor",
  title: "Editor",
  body: { kind: "webview", entry: packageAsset("./editor.ts", "file:///lab/") },
});
const page = definePage({
  id: "notes",
  title: "Notes",
  path: "notes",
  mode: workbenchModes.project,
  main: { kind: "panels", empty: view.ref },
  slots: [],
});
const placement = definePlacement({
  id: "inspector",
  mode: workbenchModes.project,
  region: "side",
  item: { kind: "view", view: view.ref, presence: "open" },
});
const binding = { kinds: [{ kind: "resource-kind", id: "note" }], view: view.ref, cardinality: "many" };

test.each([
  [
    "pages",
    { ...page, main: { kind: "view", view: view.ref, cardinality: "one", tab: { query: "bad" } } },
    "pages.notes.main.tab.query",
  ],
  [
    "pages",
    { ...page, slots: [{ id: "inspector", region: "side", item: placement.item, mountStrategyy: "active" }] },
    "pages.notes.slots.0.mountStrategyy",
  ],
  [
    "pages",
    {
      ...page,
      slots: [
        {
          id: "inspector",
          region: "side",
          item: { kind: "binding", binding: { ...binding, add: { kind: "command" } } },
        },
      ],
    },
    "pages.notes.slots.0.item.binding.add.target",
  ],
  [
    "placements",
    { ...placement, item: { kind: "binding", binding: { ...binding, cardinality: "multiple" } } },
    "placements.inspector.item.binding.cardinality",
  ],
  ["placements", { ...placement, mountStrategyy: "active" }, "placements.inspector.mountStrategyy"],
  [
    "modes",
    { ...defineMode({ id: "review", label: "Review", regions: ["main"] }), chrome: { main: view.ref } },
    "modes.review.chrome.main",
  ],
  [
    "modes",
    { ...defineMode({ id: "review", label: "Review", regions: ["main"] }), defaultTheme: "paper" },
    "modes.review.defaultTheme",
  ],
  ["views", { ...view, body: { kind: "controls", query: "bad" } }, "views.editor.body.query"],
  [
    "navigationItems",
    {
      id: "notes",
      ref: { kind: "navigation-item", id: "notes" },
      owner: workbenchModes.project,
      label: "Notes",
      action: { kind: "command" },
    },
    "navigationItems.notes.action.target",
  ],
] as const)("reports the exact declaration field: %s %j", (collection, contribution, fieldPath) => {
  const definition = defineExtension({ views: [view], [collection]: [contribution] } as never);
  const source: LoadedExtensionSource = {
    packagePath: "/lab",
    sourcePath: "/lab/extension.ts",
    sourceKind: "local_path",
    manifest: {
      id: "acme.lab",
      name: "lab",
      publisher: "acme",
      version: "1.0.0",
      main: "./extension.ts",
      enginesPstdio: EXTENSION_API_VERSION,
    },
    definition,
  };
  const runtime = normalizeExtensionSources([source]);
  const diagnostic = runtime.diagnostics.find((item) => item.metadata?.fieldPath === fieldPath);
  expect(diagnostic).toBeDefined();
  expect(diagnostic?.extensionId).toBe("acme.lab");
  expect(diagnostic?.metadata?.contributionId).toBe(contribution.id);
  expect(diagnostic?.metadata?.expected).toBeString();
  expect(diagnostic?.message).toContain("acme.lab");
  expect(diagnostic?.message).toContain(fieldPath);
  expect(diagnostic?.message).toContain("expected");
  expect(runtime[collection]).toHaveLength(0);
});
