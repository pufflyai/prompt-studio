import { expect, test } from "bun:test";
import { defineCommand, defineResourceKind } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const source = (publisher: string): LoadedExtensionSource => ({
  packagePath: `/fake/${publisher}/notes`,
  sourcePath: `/fake/${publisher}/notes/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `${publisher}.notes`,
    name: "notes",
    publisher,
    version: "1.0.0",
    main: "./extension.ts",
    enginesPstdio: "^0.2.0",
  },
  definition: {
    commands: [defineCommand({ id: "list", title: "List", cli: true, run: () => [] })],
    artifactMounts: [{ id: "notes", ref: { kind: "artifact-mount", id: "notes" }, path: "notes", label: "Notes" }],
    settings: { properties: { enabled: { type: "boolean", scope: "project", default: true } } },
    resourceKinds: [defineResourceKind({ id: "note", label: "Note" })],
  },
});
test("publishers with the same name keep separate commands, settings, resource kinds and files", () => {
  const runtime = normalizeExtensionSources([source("alice"), source("bob")]);
  expect(runtime.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  expect(runtime.cli.map((cli) => cli.pathKey)).toEqual(["alice.notes list", "bob.notes list"]);
  expect(runtime.settings.map((setting) => setting.id)).toEqual(["alice.notes.enabled", "bob.notes.enabled"]);
  expect(runtime.resourceKinds.map((kind) => kind.id)).toEqual(["alice.notes.note", "bob.notes.note"]);
  expect(runtime.artifactMounts.map((mount) => mount.fullPath)).toEqual([
    ".pstdio/extension-storage/alice.notes/notes",
    ".pstdio/extension-storage/bob.notes/notes",
  ]);
});
