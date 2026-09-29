import { expect, test } from "bun:test";
import { defineCommand, defineExtension, defineView } from "@pstdio/sdk/extensions";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import type { LoadedExtensionSource } from "../../runtime/loader";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

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
    enginesPstdio: "1.0.0-alpha.14",
  },
  definition,
});

test.each(["dataTable", "kanban"] as const)("%s toolbar actions survive the public metadata round trip", (kind) => {
  const run = defineCommand({
    id: "run",
    title: "Run",
    params: { kind: { type: "text" }, name: { type: "text" } },
    run: async () => undefined,
  });
  const action = {
    id: "run",
    label: "Run",
    command: run.ref,
    presentation: "primary" as const,
    params: { kind: "test" },
    input: { name: { type: "text" as const, required: true } },
    submitLabel: "Start",
    disabled: false,
    when: "ready",
  };
  const view =
    kind === "dataTable"
      ? defineView({
          id: "runs",
          title: "Runs",
          body: { kind: "dataTable", query: async () => ({ rows: [] }), toolbarActions: [action] },
        })
      : defineView({
          id: "runs",
          title: "Runs",
          body: { kind: "kanban", query: async () => ({ rows: [] }), toolbarActions: [action] },
        });
  const runtime = normalizeExtensionSources([source(defineExtension({ commands: [run], views: [view] }))]);
  const metadata = workbenchExtensionMetadataSchema.parse(createWorkbenchExtensionMetadata({ runtime }));
  expect(metadata.views[0]?.body).toMatchObject({
    toolbarActions: [{ ...action, command: { ...run.ref, extensionId: "pstdio.lab" } }],
  });
});
