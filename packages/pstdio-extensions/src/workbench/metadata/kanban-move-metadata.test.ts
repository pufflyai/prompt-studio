import { expect, test } from "bun:test";
import { defineExtension, defineView, eventRef } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../../runtime/loader";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

test("public complete-move and schema events reach the host as independent callbacks and dependencies", () => {
  const view = defineView({
    id: "board",
    title: "Board",
    body: {
      kind: "kanban",
      query: async () => ({ rows: [] }),
      onMove: async () => {},
      refreshEvents: [eventRef({ extensionId: "example.board", id: "content.changed" })],
      schemaRefreshEvents: [eventRef({ extensionId: "example.board", id: "schema.changed" })],
    },
  });
  const source: LoadedExtensionSource = {
    packagePath: "/fake/board",
    sourcePath: "/fake/board/extension.ts",
    sourceKind: "local_path",
    manifest: {
      id: "example.board",
      name: "board",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      enginesPstdio: "^0.1.6",
    },
    definition: defineExtension({ views: [view] }),
  };
  const runtime = normalizeExtensionSources([source]);
  const body = createWorkbenchExtensionMetadata({ runtime }).views[0].body;
  expect(body).toMatchObject({
    kind: "kanban",
    moveHandlerId: "example.board.view.board.kanban.onMove",
    refreshEventIds: ["example.board.event.content.changed"],
    schemaRefreshEventIds: ["example.board.event.schema.changed"],
  });
});

test("an explicit empty schema dependency survives normalization", () => {
  const view = defineView({
    id: "static",
    title: "Static",
    body: { kind: "kanban", query: async () => ({ rows: [] }), schemaRefreshEvents: [] },
  });
  const source: LoadedExtensionSource = {
    packagePath: "/fake/static",
    sourcePath: "/fake/static/extension.ts",
    sourceKind: "local_path",
    manifest: {
      id: "example.static",
      name: "static",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      enginesPstdio: "^0.1.6",
    },
    definition: defineExtension({ views: [view] }),
  };
  const body = createWorkbenchExtensionMetadata({ runtime: normalizeExtensionSources([source]) }).views[0].body;
  expect(body).toMatchObject({ schemaRefreshEventIds: [] });
});
