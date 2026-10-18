import { describe, expect, test } from "bun:test";
import { commandRef, defineCommand, defineExtension, defineResourceKind } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const source = (name: string, definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `pstdio.${name}`,
    name,
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: `^${EXTENSION_API_VERSION}`,
  },
  definition,
});

const resolveNote = defineCommand({ id: "resolve-note", title: "Resolve note", async run() {} });

test("resource path handlers keep their prefixes and use owner commands", () => {
  const note = defineResourceKind({
    id: "note",
    paths: [{ prefix: "notes/", resolve: resolveNote.ref }],
  });
  const runtime = normalizeExtensionSources([
    source("notes", defineExtension({ commands: [resolveNote], resourceKinds: [note] })),
  ]);
  expect(runtime.resourceKinds[0]?.paths).toEqual([
    { prefix: "notes/", resolveCommand: "pstdio.notes.command.resolve-note" },
  ]);
  expect(runtime.diagnostics).toEqual([]);
});

test("resource paths cannot run another extension's command", () => {
  const note = defineResourceKind({
    id: "note",
    paths: [{ prefix: "notes/", resolve: commandRef({ extensionId: "pstdio.other", id: "resolve-note" }) }],
  });
  const runtime = normalizeExtensionSources([
    source("notes", defineExtension({ resourceKinds: [note] })),
    source("other", defineExtension({ commands: [resolveNote] })),
  ]);
  expect(runtime.resourceKinds[0]?.paths).toEqual([]);
  expect(runtime.diagnostics).toHaveLength(1);
});

describe("resource kind resolver", () => {
  test("names the owner's resolver command by its qualified id", () => {
    const note = defineResourceKind({ id: "note", resolve: resolveNote.ref });

    const runtime = normalizeExtensionSources([
      source("notes", defineExtension({ commands: [resolveNote], resourceKinds: [note] })),
    ]);

    expect(runtime.resourceKinds[0]?.resolveCommandId).toBe("pstdio.notes.command.resolve-note");
    expect(runtime.diagnostics).toEqual([]);
  });

  test("drops a resolver that is not a command of the resource kind's extension", () => {
    const missing = defineResourceKind({ id: "note", resolve: { kind: "command", id: "missing" } });
    const foreign = defineResourceKind({
      id: "recipe",
      resolve: commandRef({ extensionId: "pstdio.other", id: "resolve-note" }),
    });

    const runtime = normalizeExtensionSources([
      source("notes", defineExtension({ resourceKinds: [missing, foreign] })),
      source("other", defineExtension({ commands: [resolveNote] })),
    ]);

    expect(runtime.resourceKinds.map((kind) => kind.resolveCommandId)).toEqual([undefined, undefined]);
    expect(runtime.diagnostics.map((diagnostic) => diagnostic.metadata?.failedReference)).toEqual([
      "pstdio.notes.command.missing",
      "pstdio.other.command.resolve-note",
    ]);
    expect(runtime.diagnostics.every((d) => d.code === "extension_resource_kind_resolver_invalid")).toBe(true);
  });
});

test("keeps an owner batch resolver and rejects a foreign batch resolver", () => {
  const note = defineResourceKind({ id: "note", resolveMany: resolveNote.ref });
  const foreign = defineResourceKind({
    id: "other-note",
    resolveMany: commandRef({ extensionId: "pstdio.other", id: "resolve-note" }),
  });
  const runtime = normalizeExtensionSources([
    source("notes", defineExtension({ commands: [resolveNote], resourceKinds: [note, foreign] })),
    source("other", defineExtension({ commands: [resolveNote] })),
  ]);
  expect(runtime.resourceKinds.map((kind) => kind.resolveManyCommandId)).toEqual([
    "pstdio.notes.command.resolve-note",
    undefined,
  ]);
  expect(runtime.diagnostics).toHaveLength(1);
});

test("qualifies related opening commands and accepts only the defining owner's command", () => {
  const valid = defineResourceKind({ id: "note", relatedOpenings: resolveNote.ref });
  const foreign = defineResourceKind({
    id: "foreign-note",
    relatedOpenings: commandRef({ extensionId: "pstdio.other", id: "resolve-note" }),
  });
  const missing = defineResourceKind({ id: "missing-note", relatedOpenings: { kind: "command", id: "missing" } });
  const runtime = normalizeExtensionSources([
    source("notes", defineExtension({ commands: [resolveNote], resourceKinds: [valid, foreign, missing] })),
    source("other", defineExtension({ commands: [resolveNote] })),
  ]);
  expect(runtime.resourceKinds.map((kind) => kind.relatedOpeningsCommandId)).toEqual([
    "pstdio.notes.command.resolve-note",
    undefined,
    undefined,
  ]);
  expect(runtime.diagnostics.map((entry) => entry.code)).toEqual([
    "extension_resource_kind_resolver_invalid",
    "extension_resource_kind_resolver_invalid",
  ]);
});
