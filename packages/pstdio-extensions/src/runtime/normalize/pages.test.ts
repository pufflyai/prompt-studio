import { describe, expect, test } from "bun:test";
import {
  defineExtension,
  definePage,
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
    enginesPstdio: EXTENSION_API_VERSION,
  },
  definition,
});
const pageView = defineView({
  id: "page",
  title: "Page",
  body: { kind: "webview", entry: packageAsset("./page.tsx", "file:///fake/lab/") },
});
const resourceView = defineView({
  id: "resource",
  title: "Resource",
  body: { kind: "webview", entry: packageAsset("./resource.tsx", "file:///fake/lab/") },
});
const ticketKind = defineResourceKind({
  id: "ticket",
});
const diagnosticsFor = (definition: LoadedExtensionSource["definition"]) =>
  normalizeExtensionSources([source(definition)]).diagnostics;
describe("page slot validation", () => {
  test("accepts one routed primary and independently addressed auxiliary panels", () => {
    const page = definePage({
      parent: { extensionId: "pstdio", kind: "page", id: "start" },
      id: "tickets",
      title: "Tickets",
      path: "tickets",
      mode: workbenchModes.project,
      resource: {
        kinds: [ticketKind.ref],
      },
      main: {
        kind: "view",
        view: resourceView.ref,
        cardinality: "many",
      },
      slots: [
        {
          id: "files",
          region: "side",
          item: {
            kind: "view",
            view: pageView.ref,
            presence: "open",
          },
        },
        {
          id: "inspector",
          region: "side",
          item: {
            kind: "binding",
            binding: {
              kinds: [ticketKind.ref],
              view: resourceView.ref,
              cardinality: "one",
            },
          },
        },
      ],
    });
    const diagnostics = diagnosticsFor(
      defineExtension({ views: [pageView, resourceView], resourceKinds: [ticketKind], pages: [page] }),
    );
    expect(diagnostics).toEqual([]);
    expect(page.panels.files).toEqual({ kind: "page-slot", page: page.ref, id: "files" });
    expect(page.panels.inspector).toEqual({ kind: "page-slot", page: page.ref, id: "inspector" });
    expect(page.panels).not.toHaveProperty("ticket");
  });
  test("requires a valid Main presentation and reports its declaration path", () => {
    // @ts-expect-error JavaScript extensions can omit a required field
    const page = definePage({
      id: "missing-main",
      title: "Missing",
      path: "missing-main",
      mode: workbenchModes.project,
      slots: [],
    });
    const diagnostics = diagnosticsFor(defineExtension({ views: [pageView], pages: [page] }));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      extensionId: "pstdio.lab",
      metadata: { contributionId: "missing-main", fieldPath: "pages.missing-main.main" },
    });
    expect(diagnostics[0]?.message).toContain("expected");
  });
  test("rejects duplicate panel ids", () => {
    const panel = {
      id: "inspector",
      region: "side" as const,
      item: { kind: "view" as const, view: pageView.ref, presence: "open" as const },
    };
    const page = definePage({
      id: "duplicate-panels",
      title: "Duplicate",
      path: "duplicate-panels",
      mode: workbenchModes.project,
      main: { kind: "view", view: pageView.ref, cardinality: "one" },
      slots: [panel, panel],
    });
    expect(
      diagnosticsFor(defineExtension({ views: [pageView], pages: [page] })).map((diagnostic) => diagnostic.code),
    ).toContain("extension_page_slot_duplicate");
  });
  test("accepts a resource route with a Main panel collection", () => {
    const page = definePage({
      id: "workspace-editor",
      title: "Workspace",
      path: "workspace-editor",
      mode: workbenchModes.project,
      resource: { kinds: [ticketKind.ref] },
      main: { kind: "panels", empty: pageView.ref },
      slots: [
        {
          id: "editor",
          region: "main",
          item: { kind: "binding", binding: { kinds: [ticketKind.ref], view: resourceView.ref, cardinality: "many" } },
        },
      ],
    });
    expect(
      diagnosticsFor(defineExtension({ views: [pageView, resourceView], resourceKinds: [ticketKind], pages: [page] })),
    ).toEqual([]);
  });
  test("allows the same resource kind in different slots without choosing a first match", () => {
    const page = definePage({
      id: "compare",
      title: "Compare",
      path: "compare",
      mode: workbenchModes.project,
      parent: { extensionId: "pstdio", kind: "page", id: "start" },
      resource: {
        kinds: [ticketKind.ref],
      },
      main: {
        kind: "view",
        view: resourceView.ref,
        cardinality: "one",
      },
      slots: [
        {
          id: "right",
          region: "side",
          item: {
            kind: "binding",
            binding: {
              kinds: [ticketKind.ref],
              view: resourceView.ref,
              cardinality: "one",
            },
          },
        },
      ],
    });
    expect(
      diagnosticsFor(defineExtension({ views: [resourceView], resourceKinds: [ticketKind], pages: [page] })),
    ).toEqual([]);
  });
  test("allows a bound auxiliary to follow the matching page resource", () => {
    const page = definePage({
      id: "ticket",
      title: "Ticket",
      path: "ticket",
      mode: workbenchModes.project,
      parent: { extensionId: "pstdio", kind: "page", id: "start" },
      resource: {
        kinds: [ticketKind.ref],
      },
      main: {
        kind: "view",
        view: resourceView.ref,
        cardinality: "one",
      },
      slots: [
        {
          id: "files",
          region: "side",
          openOn: "page-resource",
          item: {
            kind: "binding",
            binding: {
              kinds: [ticketKind.ref],
              view: resourceView.ref,
              cardinality: "one",
            },
          },
        },
      ],
    });
    expect(
      diagnosticsFor(defineExtension({ views: [resourceView], resourceKinds: [ticketKind], pages: [page] })),
    ).toEqual([]);
  });
  test("requires a parent on a resource page", () => {
    // @ts-expect-error validate JavaScript callers too
    const page = definePage({
      id: "orphan",
      title: "Orphan",
      path: "orphan",
      mode: workbenchModes.project,
      resource: {
        kinds: [ticketKind.ref],
      },
      main: {
        kind: "view",
        view: resourceView.ref,
        cardinality: "one",
      },
      slots: [],
    });
    const diagnostics = diagnosticsFor(
      defineExtension({ views: [resourceView], resourceKinds: [ticketKind], pages: [page] }),
    );
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_main_invalid")).toHaveLength(1);
  });
});
describe("page identity and hierarchy validation", () => {
  test("rejects reserved, malformed, and duplicate page paths", () => {
    const makePage = (id: string, path: string) =>
      definePage({
        id,
        title: id,
        path,
        mode: workbenchModes.project,
        main: {
          kind: "view",
          view: pageView.ref,
          cardinality: "one",
        },
        slots: [],
      });
    const diagnostics = diagnosticsFor(
      defineExtension({
        views: [pageView],
        pages: [
          makePage("reserved", "workspaces"),
          makePage("bad", "Bad Path"),
          makePage("a", "tools"),
          makePage("b", "tools"),
        ],
      }),
    );
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_path_invalid")).toHaveLength(3);
  });
  test("rejects page ids reserved by the host", () => {
    const page = definePage({
      id: "start",
      title: "Start replacement",
      path: "start-replacement",
      mode: workbenchModes.project,
      main: {
        kind: "view",
        view: pageView.ref,
        cardinality: "one",
      },
      slots: [],
    });
    const diagnostics = diagnosticsFor(defineExtension({ views: [pageView], pages: [page] }));
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_id_reserved")).toHaveLength(1);
  });
  test("validates page parents and detects own-extension cycles", () => {
    const first = definePage({
      id: "first",
      title: "First",
      path: "first",
      mode: workbenchModes.project,
      parent: { kind: "page", id: "second" },
      main: {
        kind: "view",
        view: pageView.ref,
        cardinality: "one",
      },
      slots: [],
    });
    const second = definePage({
      id: "second",
      title: "Second",
      path: "second",
      mode: workbenchModes.project,
      parent: first.ref,
      main: {
        kind: "view",
        view: pageView.ref,
        cardinality: "one",
      },
      slots: [],
    });
    const diagnostics = diagnosticsFor(defineExtension({ views: [pageView], pages: [first, second] }));
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_parent_cycle")).toHaveLength(1);
  });
  test("rejects an unknown host page parent", () => {
    const page = definePage({
      id: "child",
      title: "Child",
      path: "child",
      mode: workbenchModes.project,
      parent: { extensionId: "pstdio", kind: "page", id: "missing" },
      main: {
        kind: "view",
        view: pageView.ref,
        cardinality: "one",
      },
      slots: [],
    });
    const diagnostics = diagnosticsFor(defineExtension({ views: [pageView], pages: [page] }));
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_missing")).toHaveLength(1);
  });
});
