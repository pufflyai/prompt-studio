import { describe, expect, test } from "bun:test";
import {
  defineExtension,
  defineMode,
  definePage,
  definePlacement,
  defineResourceKind,
  defineView,
  packageAsset,
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
    enginesPstdio: `^${EXTENSION_API_VERSION}`,
  },
  definition,
});
const pageView = defineView({
  id: "page",
  title: "Page",
  body: { kind: "webview", entry: packageAsset("./page.tsx", "file:///fake/lab/") },
});
const diagnosticsFor = (definition: LoadedExtensionSource["definition"]) =>
  normalizeExtensionSources([source(definition)]).diagnostics;

test.each(["many", "one"] as const)("resource collection landing validates %s viewer cardinality", (cardinality) => {
  const kind = defineResourceKind({ id: "record" });
  const viewer = definePlacement({
    id: "record-viewer",
    mode: workbenchModes.project,
    region: "main",
    item: { kind: "binding", binding: { kinds: [kind.ref], view: pageView.ref, cardinality } },
  });
  const page = definePage({
    id: "record",
    title: "Record",
    path: "record",
    mode: workbenchModes.project,
    resource: { kinds: [kind.ref] },
    main: { kind: "panels", landing: viewer.ref },
    slots: [],
  });
  const diagnostics = diagnosticsFor(
    defineExtension({ resourceKinds: [kind], views: [pageView], placements: [viewer], pages: [page] }),
  );
  expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_panel_invalid")).toHaveLength(
    cardinality === "many" ? 0 : 1,
  );
});

test("extension pages preserve explicit page presentation through normalization", () => {
  const browser = definePlacement({
    id: "reader-browser",
    mode: workbenchModes.project,
    region: "side",
    item: { kind: "view", view: pageView.ref, presence: "closed" },
  });
  const page = definePage({
    id: "reader",
    title: "Reader",
    path: "reader",
    mode: workbenchModes.project,
    main: { kind: "view", view: pageView.ref, cardinality: "one", presentation: "page" },
    panelView: browser.ref,
    slots: [],
  });
  const runtime = normalizeExtensionSources([
    source(defineExtension({ views: [pageView], pages: [page], placements: [browser] })),
  ]);
  expect(runtime.diagnostics).toEqual([]);
  expect(runtime.pages[0]?.contribution.main).toMatchObject({ presentation: "page" });
  const panel = { extensionId: "pstdio.lab", kind: "placement" as const, id: "reader-browser" };
  expect(runtime.pages[0]?.contribution.panelView).toEqual(panel);
  expect(runtime.placements.find((placement) => placement.localId === "reader-browser")?.contribution).toMatchObject({
    ref: panel,
    region: "side",
    item: { kind: "view", presence: "closed" },
  });
});

test("a page panel version and independent landing must name a placement in the page's mode", () => {
  const page = definePage({
    id: "library",
    title: "Library",
    path: "library",
    mode: workbenchModes.project,
    panelView: { kind: "placement", id: "missing" },
    main: { kind: "panels", landing: { kind: "placement", id: "missing" } },
    slots: [],
  });
  const diagnostics = diagnosticsFor(defineExtension({ pages: [page] }));
  expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_panel_invalid")).toHaveLength(2);
});
describe("page input validation", () => {
  test("rejects malformed mode theme and chrome references", () => {
    for (const extra of [
      { defaultTheme: "paper" },
      { chrome: { sidenav: true } },
      { chrome: { main: pageView.ref } },
    ]) {
      const runtime = normalizeExtensionSources([
        source(
          defineExtension({
            modes: [{ ...defineMode({ id: "notes", label: "Notes", regions: ["main"] }), ...extra }] as never,
          }),
        ),
      ]);
      expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("invalid_mode");
    }
  });
  test("rejects a mode without declared regions", () => {
    const definition = defineExtension({
      modes: [
        {
          id: "broken-mode",
          ref: { kind: "mode", id: "broken-mode" },
          label: "Broken mode",
        },
      ] as never,
    });
    const runtime = normalizeExtensionSources([source(definition)]);
    expect(runtime.modes).toEqual([]);
    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("invalid_mode");
  });
  test("requires declared regions on extension modes used by pages", () => {
    const mode = defineMode({ id: "review", label: "Review", regions: ["main"] });
    const page = definePage({
      id: "review",
      title: "Review",
      path: "review",
      mode: mode.ref,
      main: {
        kind: "view",
        view: pageView.ref,
        cardinality: "one",
      },
      slots: [
        {
          id: "tools",
          region: "side",
          item: {
            kind: "view",
            view: pageView.ref,
            presence: "open",
          },
        },
      ],
    });
    const diagnostics = diagnosticsFor(defineExtension({ modes: [mode], views: [pageView], pages: [page] }));
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_region_invalid")).toHaveLength(1);
  });
  test("rejects invalid slot ids with the shared contribution id grammar", () => {
    const page = definePage({
      id: "bad-slot-id",
      title: "Bad slot id",
      path: "bad-slot-id",
      mode: workbenchModes.project,
      main: {
        kind: "view",
        view: pageView.ref,
        cardinality: "one",
      },
      slots: [{ id: "badSlotId", region: "side", item: { kind: "view", view: pageView.ref, presence: "open" } }],
    });
    const diagnostics = diagnosticsFor(defineExtension({ views: [pageView], pages: [page] }));
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_slot_id_invalid")).toHaveLength(1);
  });
  test("reports a malformed page instead of throwing during normalization", () => {
    const definition = defineExtension({
      pages: [
        {
          id: "broken",
          ref: { kind: "page", id: "broken" },
          title: "Broken",
          path: "broken",
          mode: workbenchModes.project,
          slots: "not-an-array",
          panels: {},
        },
      ] as never,
    });
    expect(diagnosticsFor(definition).map((diagnostic) => diagnostic.code)).toContain("invalid_page");
  });
  test("reports malformed page fields instead of throwing during normalization", () => {
    const definition = defineExtension({
      pages: [
        {
          id: "broken-mode",
          ref: { kind: "page", id: "broken-mode" },
          title: "Broken mode",
          path: "broken-mode",
          mode: null,
          panels: {},
          main: {
            kind: "view",
            view: pageView.ref,
            cardinality: "one",
          },
          slots: [],
        },
      ] as never,
    });
    const runtime = normalizeExtensionSources([source(definition)]);
    expect(runtime.pages).toEqual([]);
    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("invalid_page");
  });
  test("reports a malformed page slot instead of throwing during normalization", () => {
    const definition = defineExtension({
      pages: [
        {
          id: "broken-slot",
          ref: { kind: "page", id: "broken-slot" },
          title: "Broken slot",
          path: "broken-slot",
          mode: workbenchModes.project,
          main: { kind: "panels", empty: pageView.ref },
          slots: [null],
          panels: {},
        },
      ] as never,
    });
    expect(diagnosticsFor(definition).map((diagnostic) => diagnostic.code)).toContain("invalid_page_slot");
  });
  test("rejects invalid page slot field values", () => {
    const definition = defineExtension({
      pages: [
        {
          id: "broken-slot-fields",
          ref: { kind: "page", id: "broken-slot-fields" },
          title: "Broken slot fields",
          path: "broken-slot-fields",
          mode: workbenchModes.project,
          main: { kind: "panels", empty: pageView.ref },
          slots: [{ id: "content", region: "other", item: { kind: "view", view: pageView.ref, presence: "open" } }],
          panels: {},
        },
      ] as never,
    });
    expect(diagnosticsFor(definition).map((diagnostic) => diagnostic.code)).toContain("invalid_page_slot");
  });
  test("rejects a Main view with a non-callable tab query", () => {
    const definition = defineExtension({
      views: [pageView],
      pages: [
        {
          id: "broken-tab",
          ref: { kind: "page", id: "broken-tab" },
          title: "Broken tab",
          path: "broken-tab",
          mode: workbenchModes.project,
          panels: {},
          main: {
            kind: "view",
            view: pageView.ref,
            cardinality: "one",
            tab: { query: "not-a-function" },
          },
          slots: [],
        },
      ] as never,
    });
    expect(diagnosticsFor(definition).map((diagnostic) => diagnostic.code)).toContain("invalid_page");
  });
});

test("document declarations require a nonempty key and a routed resource", () => {
  const page = definePage({
    id: "document",
    title: "Document",
    path: "document",
    mode: workbenchModes.project,
    main: { kind: "panels", empty: pageView.ref },
    slots: [],
  });
  for (const document of [{ metadataKey: "documentId" }, { metadataKey: "" }]) {
    const runtime = normalizeExtensionSources([
      source(defineExtension({ views: [pageView], pages: [{ ...page, document }] })),
    ]);
    expect(runtime.diagnostics.map((item) => item.code)).toContain("invalid_page");
  }
});
