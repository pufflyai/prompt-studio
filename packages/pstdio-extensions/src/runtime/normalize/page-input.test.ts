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
    enginesPstdio: EXTENSION_API_VERSION,
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
      slots: [
        { id: "content", role: "primary", region: "main", view: pageView.ref },
        { id: "tools", role: "auxiliary", region: "side", view: pageView.ref },
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
      slots: [{ id: "Bad Slot", role: "primary", region: "main", view: pageView.ref }],
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
          slots: [{ id: "content", role: "primary", region: "main", view: pageView.ref }],
          panels: {},
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
          slots: [{ id: "content", role: "other", region: "main", view: pageView.ref }],
          panels: {},
        },
      ] as never,
    });

    expect(diagnosticsFor(definition).map((diagnostic) => diagnostic.code)).toContain("invalid_page_slot");
  });
});
