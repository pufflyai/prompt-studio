import { expect, test } from "bun:test";
import { defineExtension, defineView } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION, workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import { createWorkbenchExtensionMetadata } from "../../workbench/metadata/workbench-extension-metadata";
import { checkExtensionHostCompatibility, dashboardExtensionHostCapabilities } from "../host-capabilities";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

test("cursor page callbacks survive normalization and require a supporting host", () => {
  const page = async () => ({ nodes: [] });
  const definition = defineExtension({
    views: [
      defineView({
        id: "history",
        title: "History",
        body: {
          kind: "tree",
          body: async () => [{ id: "sessions", nodes: [], nextCursor: "older" }],
          page,
        },
      }),
    ],
  });
  const source: LoadedExtensionSource = {
    packagePath: "/fake/history",
    sourcePath: "/fake/history/extension.ts",
    sourceKind: "local_path",
    manifest: {
      id: "example.history",
      name: "history",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      enginesPstdio: `^${EXTENSION_API_VERSION}`,
    },
    definition,
  };
  const runtime = normalizeExtensionSources([source]);
  expect(runtime.diagnostics).toEqual([]);
  expect(runtime.privateHandlers).toContainEqual(expect.objectContaining({ operation: "page", handler: page }));
  const metadata = workbenchExtensionMetadataSchema.parse(createWorkbenchExtensionMetadata({ runtime }));
  expect(metadata.views[0]!.body).toMatchObject({
    kind: "tree",
    pageHandlerId: "example.history.view.history.tree.page",
  });
  expect(checkExtensionHostCompatibility(runtime, dashboardExtensionHostCapabilities).diagnostics).toEqual([]);
  const { "view.tree.pages.v1": _pages, ...capabilities } = dashboardExtensionHostCapabilities.capabilities;
  expect(
    checkExtensionHostCompatibility(runtime, { ...dashboardExtensionHostCapabilities, capabilities }).diagnostics,
  ).toContainEqual(
    expect.objectContaining({
      code: "extension_host_capability_missing",
      metadata: expect.objectContaining({ missingCapability: "view.tree.pages.v1" }),
    }),
  );
});
