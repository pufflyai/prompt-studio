import { expect, test } from "bun:test";
import { defineExtension, defineView } from "@pstdio/sdk/extensions";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import type { LoadedExtensionSource } from "../../runtime/loader";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

test("tree structure survives normalization, metadata serialization, and schema parsing", () => {
  const structure = [
    { id: "ticket", resourceNode: { id: "self", icon: "Ticket" } },
    { id: "files", label: "Files" },
  ];
  let reads = 0;
  const tree = defineView({
    id: "files",
    title: "Files",
    body: {
      kind: "tree",
      structure,
      body: async () => {
        reads++;
        return [];
      },
    },
  });
  const source: LoadedExtensionSource = {
    packagePath: "/fake/lab",
    sourcePath: "/fake/lab/extension.ts",
    sourceKind: "local_path",
    manifest: {
      id: "pstdio.lab",
      name: "lab",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      enginesPstdio: "^0.2.0",
    },
    definition: defineExtension({ views: [tree] }),
  };
  const metadata = createWorkbenchExtensionMetadata({
    runtime: normalizeExtensionSources([source]),
    resolveWebview: () => null,
  });
  const parsed = workbenchExtensionMetadataSchema.parse(JSON.parse(JSON.stringify(metadata)));
  expect(parsed.views[0]?.body).toMatchObject({ kind: "tree", structure });
  expect(reads).toBe(0);
});
