import { expect, test } from "bun:test";
import { defineCommand, defineExtension, defineResourceKind, defineView } from "@pstdio/sdk/extensions";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
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
    enginesPstdio: `^${EXTENSION_API_VERSION}`,
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
  const resourceKind = defineResourceKind({ id: "ticket", label: "Ticket", icon: "ticket" });
  const view =
    kind === "dataTable"
      ? defineView({
          id: "runs",
          title: "Runs",
          body: {
            kind: "dataTable",
            resourceKind: resourceKind.ref,
            query: async () => ({ rows: [] }),
            toolbarActions: [action],
          },
        })
      : defineView({
          id: "runs",
          title: "Runs",
          body: {
            kind: "kanban",
            resourceKind: resourceKind.ref,
            query: async () => ({ rows: [] }),
            toolbarActions: [action],
          },
        });
  const runtime = normalizeExtensionSources([
    source(defineExtension({ commands: [run], resourceKinds: [resourceKind], views: [view] })),
  ]);
  const metadata = workbenchExtensionMetadataSchema.parse(createWorkbenchExtensionMetadata({ runtime }));
  expect(metadata.views[0]?.body).toMatchObject({
    resourceKind: "ticket",
    toolbarActions: [{ ...action, command: { ...run.ref, extensionId: "pstdio.lab" } }],
  });
});
