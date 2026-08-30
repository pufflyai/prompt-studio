import { describe, expect, test } from "bun:test";
import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineResourceKind,
  defineView,
  packageAsset,
  workbenchPages,
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

const view = defineView({
  id: "board",
  title: "Board",
  body: { kind: "webview", entry: packageAsset("./views/board.tsx", "file:///fake/lab/") },
});
const editor = defineView({
  id: "editor",
  title: "Editor",
  body: { kind: "webview", entry: packageAsset("./views/editor.tsx", "file:///fake/lab/") },
});
const ticket = defineResourceKind({ id: "ticket" });

const diagnosticsFor = (definition: LoadedExtensionSource["definition"]) =>
  normalizeExtensionSources([source(definition)]).diagnostics;

describe("page validation", () => {
  test("accepts a complete page with static, bound, and follows slots", () => {
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      path: "tickets",
      slots: [
        { id: "board", region: "main", view: view.ref, closable: false },
        { id: "ticket", region: "main", cardinality: "many" },
        { id: "files", region: "sidenav", follows: "ticket" },
      ],
      bindings: [
        { resourceKind: ticket.ref, view: editor.ref, slot: "ticket" },
        { resourceKind: ticket.ref, view: editor.ref, slot: "files" },
      ],
    });

    expect(diagnosticsFor(defineExtension({ views: [view, editor], resourceKinds: [ticket], pages: [page] }))).toEqual(
      [],
    );
  });

  test("rejects a static slot with bound-slot fields and a bound slot with static fields", () => {
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      slots: [
        { id: "board", region: "main", view: view.ref, cardinality: "many" },
        { id: "ticket", region: "main", cardinality: "many", scope: "location" },
      ],
      bindings: [{ resourceKind: ticket.ref, view: editor.ref, slot: "ticket" }],
    });

    const codes = diagnosticsFor(
      defineExtension({ views: [view, editor], resourceKinds: [ticket], pages: [page] }),
    ).map((diagnostic) => diagnostic.code);
    expect(codes.filter((code) => code === "extension_page_slot_invalid")).toHaveLength(2);
  });

  test("rejects many-cardinality slots outside the panel regions", () => {
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      slots: [{ id: "ticket", region: "sidenav", cardinality: "many" }],
      bindings: [{ resourceKind: ticket.ref, view: editor.ref, slot: "ticket" }],
    });

    const diagnostics = diagnosticsFor(
      defineExtension({ views: [view, editor], resourceKinds: [ticket], pages: [page] }),
    );
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("panel region"))).toBe(true);
  });

  test("rejects follows that names a non-many slot or shares no bound kind", () => {
    const other = defineResourceKind({ id: "run" });
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      slots: [
        { id: "ticket", region: "main", cardinality: "many" },
        { id: "files", region: "sidenav", follows: "ticket" },
      ],
      bindings: [
        { resourceKind: ticket.ref, view: editor.ref, slot: "ticket" },
        { resourceKind: other.ref, view: editor.ref, slot: "files" },
      ],
    });

    const diagnostics = diagnosticsFor(
      defineExtension({ views: [view, editor], resourceKinds: [ticket, other], pages: [page] }),
    );
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_page_follows_invalid");
  });

  test("rejects bindings that target static or unknown slots and duplicate kind bindings", () => {
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      slots: [
        { id: "board", region: "main", view: view.ref },
        { id: "ticket", region: "main", cardinality: "many" },
      ],
      bindings: [
        { resourceKind: ticket.ref, view: editor.ref, slot: "board" },
        { resourceKind: ticket.ref, view: editor.ref, slot: "ticket" },
        { resourceKind: ticket.ref, view: editor.ref, slot: "ticket" },
      ],
    });

    const codes = diagnosticsFor(
      defineExtension({ views: [view, editor], resourceKinds: [ticket], pages: [page] }),
    ).map((diagnostic) => diagnostic.code);
    expect(codes.filter((code) => code === "extension_page_binding_invalid")).toHaveLength(2);
  });

  test("rejects reserved and duplicate page paths", () => {
    const first = definePage({
      id: "one",
      title: "One",
      path: "workspaces",
      slots: [{ id: "a", region: "main", view: view.ref }],
    });
    const second = definePage({
      id: "two",
      title: "Two",
      path: "tools",
      slots: [{ id: "a", region: "main", view: view.ref }],
    });
    const third = definePage({
      id: "three",
      title: "Three",
      path: "tools",
      slots: [{ id: "a", region: "main", view: view.ref }],
    });

    const diagnostics = diagnosticsFor(defineExtension({ views: [view], pages: [first, second, third] }));
    const pathErrors = diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_path_invalid");
    expect(pathErrors).toHaveLength(2);
    expect(pathErrors[0]?.message).toContain("reserved host segment");
  });

  test("validates page targets: unknown slots and unbound resource kinds fail", () => {
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      slots: [
        { id: "board", region: "main", view: view.ref },
        { id: "ticket", region: "main", cardinality: "many" },
      ],
      bindings: [{ resourceKind: ticket.ref, view: editor.ref, slot: "ticket" }],
    });
    const diagnostics = diagnosticsFor(
      defineExtension({
        views: [view, editor],
        resourceKinds: [ticket],
        pages: [page],
        navigationItems: [
          defineNavigationItem({
            id: "bad-slot",
            slot: workbenchSlots.projectNavigation,
            label: "Bad slot",
            action: { kind: "page", page: page.ref, slot: "missing" },
          }),
          defineNavigationItem({
            id: "bad-kind",
            slot: workbenchSlots.projectNavigation,
            label: "Bad kind",
            action: { kind: "page", page: page.ref, resource: { type: "run", id: "r-1" } },
          }),
        ],
      }),
    );

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_target_invalid")).toHaveLength(2);
  });

  test("validates host page targets against their published bound kinds", () => {
    const page = definePage({ id: "tools", title: "Tools", slots: [{ id: "a", region: "main", view: view.ref }] });
    const diagnostics = diagnosticsFor(
      defineExtension({
        views: [view],
        pages: [page],
        navigationItems: [
          defineNavigationItem({
            id: "workspace-link",
            slot: workbenchSlots.projectNavigation,
            label: "Workspace",
            action: { kind: "page", page: workbenchPages.workspaces, resource: { type: "workspace", id: "ws-1" } },
          }),
          defineNavigationItem({
            id: "bad-host-link",
            slot: workbenchSlots.projectNavigation,
            label: "Bad",
            action: { kind: "page", page: workbenchPages.workspaces, resource: { type: "ticket", id: "t-1" } },
          }),
        ],
      }),
    );

    const targetErrors = diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_target_invalid");
    expect(targetErrors).toHaveLength(1);
    expect(targetErrors[0]?.message).toContain("workspaces");
  });

  test("warns when scope location is inert because the page binds nothing", () => {
    const page = definePage({
      id: "tools",
      title: "Tools",
      slots: [{ id: "a", region: "main", view: view.ref, scope: "location" }],
    });

    const diagnostics = diagnosticsFor(defineExtension({ views: [view], pages: [page] }));
    const warning = diagnostics.find((diagnostic) => diagnostic.code === "extension_page_scope_inert");
    expect(warning?.severity).toBe("warning");
  });
});
