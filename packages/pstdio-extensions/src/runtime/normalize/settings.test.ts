import { describe, expect, test } from "bun:test";
import type { ExtensionDefinition } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const wrap = (definition: ExtensionDefinition): LoadedExtensionSource => ({
  packagePath: "/fake/lab",
  sourcePath: "/fake/lab/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: "pstdio.lab",
    name: "lab",
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^1.0.0",
  },
  definition,
});

describe("normalizeExtensionSources settings", () => {
  test("registers declared settings", () => {
    const runtime = normalizeExtensionSources([
      wrap({
        settings: {
          properties: {
            "counter.step": { type: "number", scope: "project", default: 1 },
            "greeting.tone": {
              type: "string",
              scope: "global",
              enum: ["friendly", "formal"],
              default: "friendly",
            },
          },
        },
      }),
    ]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.settings).toEqual([
      expect.objectContaining({
        id: "lab.counter.step",
        key: "counter.step",
        extensionId: "pstdio.lab",
        contribution: expect.objectContaining({ type: "number", scope: "project", default: 1 }),
      }),
      expect.objectContaining({
        id: "lab.greeting.tone",
        key: "greeting.tone",
        extensionId: "pstdio.lab",
        contribution: expect.objectContaining({ type: "string", scope: "global", default: "friendly" }),
      }),
    ]);
  });

  test("rejects invalid declarations", () => {
    const runtime = normalizeExtensionSources([
      wrap({
        settings: {
          properties: {
            "counter.step": { type: "number", scope: "project", default: "1" },
            "greeting.tone": { type: "string", scope: "workspace" },
          },
        },
      } as never),
    ]);

    expect(runtime.settings).toEqual([]);
    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "extension_setting_invalid",
      "extension_settings_scope_invalid",
    ]);
  });

  test("rejects enum defaults outside declared values", () => {
    const runtime = normalizeExtensionSources([
      wrap({
        settings: {
          properties: {
            "greeting.tone": {
              type: "string",
              scope: "global",
              enum: ["friendly", "formal"],
              default: "sarcastic",
            },
          },
        },
      }),
    ]);

    expect(runtime.settings).toEqual([]);
    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["extension_setting_invalid"]);
  });
});
