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
      slots: [
        {
          id: "ticket",
          role: "primary",
          region: "main",

          binding: { kind: ticketKind.ref, view: resourceView.ref, cardinality: "many" },
        },
        { id: "files", role: "auxiliary", region: "side", view: pageView.ref, presence: "open" },
        {
          id: "inspector",
          role: "auxiliary",
          region: "side",
          binding: { kind: ticketKind.ref, view: resourceView.ref, cardinality: "one" },
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

  test("requires exactly one primary slot and keeps it in main", () => {
    const missingPrimary = definePage({
      id: "missing-primary",
      title: "Missing",
      path: "missing-primary",
      mode: workbenchModes.project,
      slots: [{ id: "tools", role: "auxiliary", region: "side", view: pageView.ref, presence: "open" }],
    });
    const misplacedPrimary = definePage({
      id: "misplaced-primary",
      title: "Misplaced",
      path: "misplaced-primary",
      mode: workbenchModes.project,
      slots: [
        // @ts-expect-error validate JavaScript callers too
        { id: "content", role: "primary", region: "side", view: pageView.ref },
      ],
    });

    const diagnostics = diagnosticsFor(
      defineExtension({ views: [pageView], pages: [missingPrimary, misplacedPrimary] }),
    );

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_primary_invalid")).toHaveLength(2);
    expect(diagnostics.every((diagnostic) => typeof diagnostic.metadata?.fieldPath === "string")).toBe(true);
  });

  test("rejects duplicate slot ids and invalid static or bound slot state", () => {
    const page = definePage({
      id: "invalid-slots",
      title: "Invalid slots",
      path: "invalid-slots",
      mode: workbenchModes.project,
      slots: [
        { id: "content", role: "primary", region: "main", view: pageView.ref },
        {
          id: "content",
          role: "auxiliary",
          region: "side",
          binding: { kind: ticketKind.ref, view: resourceView.ref, cardinality: "one" },
        },
        // @ts-expect-error an auxiliary slot must declare a view or a binding
        { id: "empty", role: "auxiliary", region: "secondary" },
        {
          id: "both",
          role: "auxiliary",
          region: "side",
          view: pageView.ref,
          presence: "open",
          // @ts-expect-error a static auxiliary slot cannot also bind resources
          binding: { kind: ticketKind.ref, view: resourceView.ref, cardinality: "one" },
        },
      ],
    });

    const codes = diagnosticsFor(
      defineExtension({ views: [pageView, resourceView], resourceKinds: [ticketKind], pages: [page] }),
    ).map((diagnostic) => diagnostic.code);

    expect(codes).toContain("extension_page_slot_duplicate");
    expect(codes.filter((code) => code === "invalid_page_slot")).toHaveLength(2);
  });

  test("rejects removed alpha.8 lifecycle fields with field-specific diagnostics", () => {
    const page = definePage({
      id: "legacy-slots",
      title: "Legacy slots",
      path: "legacy-slots",
      mode: workbenchModes.project,
      slots: [
        { id: "content", role: "primary", region: "main", view: pageView.ref },
        {
          id: "files",
          role: "auxiliary",
          region: "side",
          view: pageView.ref,
          presence: "open",
          // A JSON-declared extension can still send the removed field.
          ...({ defaultOpen: true } as object),
        },
        {
          id: "inspector",
          role: "auxiliary",
          region: "side",
          binding: { kind: ticketKind.ref, view: resourceView.ref, cardinality: "one" },
          ...({ defaultResource: { type: "ticket", id: "PS-1" } } as object),
        },
      ],
    });

    const diagnostics = diagnosticsFor(
      defineExtension({ views: [pageView, resourceView], resourceKinds: [ticketKind], pages: [page] }),
    );

    const fieldPaths = diagnostics.map((diagnostic) => diagnostic.metadata?.fieldPath);
    expect(diagnostics.every((diagnostic) => diagnostic.code === "invalid_page_slot")).toBe(true);
    expect(fieldPaths).toContain("pages.legacy-slots.slots.1.defaultOpen");
    expect(fieldPaths).toContain("pages.legacy-slots.slots.2.defaultResource");
    expect(diagnostics.map((diagnostic) => diagnostic.message).join(" ")).toContain("presence");
  });

  test("allows the same resource kind in different slots without choosing a first match", () => {
    const page = definePage({
      id: "compare",
      title: "Compare",
      path: "compare",
      mode: workbenchModes.project,
      parent: { extensionId: "pstdio", kind: "page", id: "start" },
      slots: [
        {
          id: "left",
          role: "primary",
          region: "main",
          binding: { kind: ticketKind.ref, view: resourceView.ref, cardinality: "one" },
        },
        {
          id: "right",
          role: "auxiliary",
          region: "side",
          binding: { kind: ticketKind.ref, view: resourceView.ref, cardinality: "one" },
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
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          binding: { kind: ticketKind.ref, view: resourceView.ref, cardinality: "one" },
        },
        {
          id: "files",
          role: "auxiliary",
          region: "side",
          binding: { kind: ticketKind.ref, view: resourceView.ref, cardinality: "one" },
          openOn: "page-resource",
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
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          binding: { kind: ticketKind.ref, view: resourceView.ref, cardinality: "one" },
        },
      ],
    });

    const diagnostics = diagnosticsFor(
      defineExtension({ views: [resourceView], resourceKinds: [ticketKind], pages: [page] }),
    );

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_primary_invalid")).toHaveLength(1);
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
        slots: [{ id: "content", role: "primary", region: "main", view: pageView.ref }],
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
      slots: [{ id: "content", role: "primary", region: "main", view: pageView.ref }],
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
      slots: [{ id: "content", role: "primary", region: "main", view: pageView.ref }],
    });
    const second = definePage({
      id: "second",
      title: "Second",
      path: "second",
      mode: workbenchModes.project,
      parent: first.ref,
      slots: [{ id: "content", role: "primary", region: "main", view: pageView.ref }],
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
      slots: [{ id: "content", role: "primary", region: "main", view: pageView.ref }],
    });

    const diagnostics = diagnosticsFor(defineExtension({ views: [pageView], pages: [page] }));

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_missing")).toHaveLength(1);
  });
});
