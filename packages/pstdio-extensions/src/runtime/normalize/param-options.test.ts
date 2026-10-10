import { expect, mock, test } from "bun:test";
import { defineCommand, defineExtension, defineView } from "@pstdio/sdk/extensions";
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
    enginesPstdio: `^${EXTENSION_API_VERSION}`,
  },
  definition,
});
const choices = (id: string, field?: string) => ({
  type: "select" as const,
  options: {
    command: { kind: "command" as const, id },
    valueField: "id",
    labelField: "name",
    params: field ? { parent: { kind: "param-value", key: field } } : undefined,
  },
});

test("qualifies option commands without executing them", () => {
  const run = mock(async () => []);
  const options = defineCommand({ id: "options", title: "Options", run });
  const create = defineCommand({
    id: "create",
    title: "Create",
    params: { choice: choices("options") },
    run: async () => undefined,
  });
  const runtime = normalizeExtensionSources([source(defineExtension({ commands: [options, create] }))]);
  expect(runtime.commands.find((c) => c.localId === "create")?.params.choice).toMatchObject({
    options: { command: { extensionId: "pstdio.lab" } },
  });
  expect(runtime.diagnostics).toEqual([]);
  expect(run).not.toHaveBeenCalled();
});

test("rejects unknown option commands and dependency cycles", () => {
  const create = defineCommand({
    id: "create",
    title: "Create",
    params: { a: choices("missing", "b"), b: choices("create", "a") },
    run: async () => undefined,
  });
  const runtime = normalizeExtensionSources([source(defineExtension({ commands: [create] }))]);
  expect(runtime.diagnostics.map((d) => d.code)).toContain("unknown_param_option_command");
  expect(runtime.diagnostics.map((d) => d.code)).toContain("param_option_dependency_cycle");
});

test("validates toolbar inputs and warns about competing primary actions", () => {
  const create = defineCommand({ id: "create", title: "Create", run: async () => undefined });
  const action = {
    id: "create",
    label: "Create",
    command: create.ref,
    presentation: "primary" as const,
    input: { choice: choices("missing", "unknown") },
  };
  const view = defineView({
    id: "table",
    title: "Table",
    body: {
      kind: "dataTable",
      query: async () => ({ rows: [] }),
      toolbarActions: [action, { ...action, id: "other" }],
    },
  });
  const runtime = normalizeExtensionSources([source(defineExtension({ commands: [create], views: [view] }))]);
  expect(runtime.diagnostics.map((d) => d.code)).toContain("unknown_param_option_field");
  expect(runtime.diagnostics.find((d) => d.code === "multiple_primary_toolbar_actions")?.severity).toBe("warning");
});

test("qualifies workspace choice commands and validates their dependencies", () => {
  const options = defineCommand({ id: "options", title: "Options", run: async () => [] });
  const runtime = normalizeExtensionSources([
    source(
      defineExtension({
        commands: [options],
        workspaceTypes: [
          {
            id: "cloud",
            ref: { kind: "workspace-type", id: "cloud" },
            label: "Cloud",
            params: { instance: choices("options"), template: choices("options", "instance") },
            create: async () => ({}) as never,
            resolve: async () => ({}) as never,
          },
        ],
      }),
    ),
  ]);
  expect(runtime.diagnostics).toEqual([]);
  expect(runtime.workspaceTypes[0].provider.params?.template).toMatchObject({
    options: { command: { id: "options", extensionId: "pstdio.lab" } },
  });
});

test("diagnoses invalid workspace choice commands and field dependencies", () => {
  const runtime = normalizeExtensionSources([
    source(
      defineExtension({
        workspaceTypes: [
          {
            id: "cloud",
            ref: { kind: "workspace-type", id: "cloud" },
            label: "Cloud",
            params: { template: choices("missing", "instance") },
            create: async () => ({}) as never,
            resolve: async () => ({}) as never,
          },
        ],
      }),
    ),
  ]);
  expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("unknown_param_option_command");
  expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("unknown_param_option_field");
});

test("diagnoses option commands on kanban create-row forms", () => {
  const runtime = normalizeExtensionSources([
    source(
      defineExtension({
        views: [
          defineView({
            id: "board",
            title: "Board",
            body: {
              kind: "kanban",
              query: () => ({ rows: [] }),
              createRow: {
                params: { choice: choices("unknown") },
                title: "Create",
                command: { kind: "command", id: "create" },
              },
            },
          }),
        ],
      }),
    ),
  ]);
  expect(runtime.diagnostics.filter((d) => d.code === "unsupported_param_option_source")).toHaveLength(1);
});
