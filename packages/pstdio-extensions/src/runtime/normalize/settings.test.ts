import { describe, expect, test } from "bun:test";
import { defineCommand, type ExtensionDefinition } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";
import { toSettingDefinitionRecord } from "./settings";

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

  test("resolves the command that loads a string setting's choices to its full command id", () => {
    const branches = defineCommand({ id: "branches", title: "Branches", run: async () => [] });
    const runtime = normalizeExtensionSources([
      wrap({
        commands: [branches],
        settings: {
          properties: {
            "target.branch": {
              type: "string",
              scope: "project",
              default: "",
              options: { command: branches.ref, valueField: "branch", labelField: "branch" },
            },
          },
        },
      }),
    ]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.settings.map(toSettingDefinitionRecord)).toEqual([
      expect.objectContaining({
        key: "target.branch",
        options: { commandId: "pstdio.lab.command.branches", valueField: "branch", labelField: "branch" },
      }),
    ]);
  });

  test("ignores options on non-string settings and reports unknown option commands", () => {
    const options = { command: { kind: "command", id: "missing" }, valueField: "id", labelField: "name" };
    const runtime = normalizeExtensionSources([
      wrap({
        settings: {
          properties: {
            "counter.step": { type: "number", scope: "project", options },
            "target.branch": { type: "string", scope: "project", options },
          },
        },
      } as never),
    ]);

    expect(runtime.settings.map((setting) => [setting.key, setting.contribution.options !== undefined])).toEqual([
      ["counter.step", false],
      ["target.branch", true],
    ]);
    expect(runtime.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.severity])).toEqual([
      ["extension_setting_options_ignored", "warning"],
      ["unknown_setting_option_command", "error"],
    ]);
  });
});
