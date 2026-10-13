import { describe, expect, test } from "bun:test";
import {
  defineExtension,
  defineMode,
  definePage,
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
describe("page input validation", () => {
  test("normalizes page menus and bottom slots independently of mode panels", () => {
    const mode = defineMode({ id: "page-only", label: "Page only", regions: ["main"] });
    const page = definePage({
      id: "page-tools",
      title: "Page tools",
      path: "page-tools",
      mode: mode.ref,
      main: { kind: "panels", empty: pageView.ref },
      panelMenus: { left: undefined, right: { view: pageView.ref, size: { defaultPx: 200 }, collapsible: false } },
      regionSettings: { main: { showHeader: false }, bottom: { size: { defaultPx: 160 }, alwaysShowTabs: true } },
      slots: [{ id: "tools", region: "bottom", item: { kind: "view", view: pageView.ref, presence: "open" } }],
    });
    const runtime = normalizeExtensionSources([
      source(defineExtension({ modes: [mode], views: [pageView], pages: [page] })),
    ]);
    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.pages[0]?.contribution.panelMenus?.right?.view).toMatchObject({
      extensionId: "pstdio.lab",
      kind: "view",
      id: "page",
    });
    expect(runtime.pages[0]?.contribution.slots[0]?.region).toBe("bottom");
    expect(runtime.pages[0]?.contribution.regionSettings?.main).toEqual({ showHeader: false });
  });
  test("reports a missing view in a page menu", () => {
    const page = definePage({
      id: "page-tools",
      title: "Page tools",
      path: "page-tools",
      mode: workbenchModes.project,
      main: { kind: "panels", empty: pageView.ref },
      slots: [],
      panelMenus: { left: { view: { kind: "view", id: "missing" } } },
    });
    const diagnostics = diagnosticsFor(defineExtension({ views: [pageView], pages: [page] }));
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_view_missing");
  });
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
