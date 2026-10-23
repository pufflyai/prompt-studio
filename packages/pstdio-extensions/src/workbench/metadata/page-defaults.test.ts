import { expect, test } from "bun:test";
import { defineExtension, definePage, defineView, packageAsset, workbenchModes } from "@pstdio/sdk/extensions";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import type { LoadedExtensionSource } from "../../runtime/loader";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

test("page header defaults and empty views survive normalization and metadata serialization", () => {
  const view = defineView({
    id: "editor",
    title: "Editor",
    body: { kind: "webview", entry: packageAsset("./editor.tsx", import.meta.url) },
  });
  const page = definePage({
    id: "editor",
    title: "Editor",
    path: "editor",
    mode: workbenchModes.project,
    regionSettings: { main: { showHeader: false }, side: { showHeader: true } },
    main: { kind: "view", view: view.ref, cardinality: "one", empty: view.ref },
    slots: [],
  });
  const source: LoadedExtensionSource = {
    packagePath: "/fake/lab",
    sourcePath: "/fake/lab/extension.ts",
    sourceKind: "local_path",
    manifest: {
      id: "example.lab",
      name: "lab",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      enginesPstdio: "^0.2.0",
    },
    definition: defineExtension({ views: [view], pages: [page] }),
  };
  const runtime = normalizeExtensionSources([source]);
  expect(runtime.diagnostics).toEqual([]);
  const metadata = workbenchExtensionMetadataSchema.parse(
    JSON.parse(JSON.stringify(createWorkbenchExtensionMetadata({ runtime }))),
  );
  expect(metadata.pages[0].regionSettings).toEqual(page.regionSettings);
  expect(metadata.pages[0].main).toMatchObject({ empty: { extensionId: "example.lab", kind: "view", id: "editor" } });
});

test("a collection can use the host placeholder without declaring an empty view", () => {
  const page = definePage({
    id: "collection",
    title: "Collection",
    path: "collection",
    mode: workbenchModes.project,
    main: { kind: "panels" },
    slots: [],
  });
  const runtime = normalizeExtensionSources([
    {
      packagePath: "/fake/lab",
      sourcePath: "/fake/lab/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "example.lab",
        name: "lab",
        publisher: "example",
        version: "1.0.0",
        main: "./extension.ts",
        enginesPstdio: "^0.2.0",
      },
      definition: defineExtension({ pages: [page] }),
    },
  ]);
  expect(runtime.diagnostics).toEqual([]);
  const metadata = workbenchExtensionMetadataSchema.parse(
    JSON.parse(JSON.stringify(createWorkbenchExtensionMetadata({ runtime }))),
  );
  expect(metadata.pages[0].main).toEqual({ kind: "panels" });
});
