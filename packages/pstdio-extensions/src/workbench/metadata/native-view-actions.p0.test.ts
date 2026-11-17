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

test("resource group context-menu targets retain their extension owner", () => {
  const details = defineCommand({ id: "details", title: "Device details", run: async () => undefined });
  const view = defineView({
    id: "devices",
    title: "Devices",
    body: {
      kind: "resourceList",
      attributes: [
        {
          id: "device",
          label: "Device",
          type: {
            kind: "enum",
            options: [
              {
                value: "local",
                label: "Local",
                contextMenuActions: [
                  {
                    id: "details",
                    label: "This device",
                    action: { kind: "command", target: { command: details.ref } },
                  },
                ],
              },
            ],
          },
        },
      ],
      query: async () => ({ rows: [] }),
    },
  });
  const runtime = normalizeExtensionSources([source(defineExtension({ commands: [details], views: [view] }))]);
  const metadata = workbenchExtensionMetadataSchema.parse(createWorkbenchExtensionMetadata({ runtime }));
  expect(metadata.views[0]?.body).toMatchObject({
    attributes: [
      {
        type: {
          options: [
            {
              contextMenuActions: [
                {
                  action: {
                    kind: "command",
                    target: { command: { kind: "command", id: "details", extensionId: "pstdio.lab" } },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  });
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
            initialPageSize: 500,
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
            initialPageSize: 500,
            toolbarActions: [action],
          },
        });
  const runtime = normalizeExtensionSources([
    source(defineExtension({ commands: [run], resourceKinds: [resourceKind], views: [view] })),
  ]);
  const metadata = workbenchExtensionMetadataSchema.parse(createWorkbenchExtensionMetadata({ runtime }));
  expect(metadata.views[0]?.body).toMatchObject({
    resourceKind: "ticket",
    initialPageSize: 500,
    toolbarActions: [{ ...action, command: { ...run.ref, extensionId: "pstdio.lab" } }],
  });
});
