import { expect, test } from "bun:test";
import { defineExtension, defineMode, definePage, defineView } from "@pstdio/sdk/extensions";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

test("page expansion opt-out survives SDK normalization and host metadata", () => {
  const mode = defineMode({ id: "music", label: "Music", regions: ["main"] });
  const view = defineView({
    id: "playlist",
    title: "Playlist",
    body: { kind: "controls", query: async () => ({ values: {} }) },
  });
  const page = definePage({
    id: "playlist",
    title: "Playlist",
    path: "playlist",
    mode: mode.ref,
    expandable: false,
    main: { kind: "view", view: view.ref, cardinality: "one" },
    slots: [],
  });
  const runtime = normalizeExtensionSources([
    {
      packagePath: "/tmp/page-expansion-fixture",
      sourcePath: "/tmp/page-expansion-fixture/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "example.music",
        name: "music",
        publisher: "example",
        version: "1.0.0",
        main: "./extension.ts",
        enginesPstdio: "^0.1.0",
      },
      definition: defineExtension({ modes: [mode], views: [view], pages: [page] }),
    },
  ]);
  expect(runtime.diagnostics).toEqual([]);
  expect(
    workbenchExtensionMetadataSchema.parse(createWorkbenchExtensionMetadata({ runtime })).pages[0]?.expandable,
  ).toBe(false);
});
