import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PstdioClient } from "@pstdio/sdk/client";
import { loadPluginRuntime } from "pstdio-plugins/hooks";
import { createExtensionCommandModule } from "./command-runner";

let tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-command-runner-test-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }

  tempDirs = [];
});

const createStubClient = () =>
  ({
    tickets: {
      list: async () => [{ id: "ticket-1", shorthand: "PS-1" }],
    },
    workspaces: {
      list: async () => [{ id: "workspace-1", workspace_shorthand: "PS-1-A1" }],
    },
    sessions: {
      create: async () => ({ id: "session-1" }),
    },
  }) as unknown as PstdioClient;

describe("createExtensionCommandModule", () => {
  test("runs a command with mapped params, resolved target, and storage context", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "extension-lab.ts"),
      `export default {
        commands: [{
          key: "save-state",
          path: "lab save-state",
          description: "Save state",
          targetType: "ticket",
          params: [
            { key: "note", label: "Note", type: "text", required: true },
            { key: "count", label: "Count", type: "number", required: true },
            { key: "enabled", label: "Enabled", type: "boolean" },
            {
              key: "mode",
              label: "Mode",
              type: "select",
              options: [
                { value: "safe", label: "Safe" },
                { value: "fast", label: "Fast" },
              ],
            },
          ],
          async run(ctx) {
            await ctx.storage.set("last", {
              target: ctx.target.shorthand,
              params: ctx.params,
            });

            return { message: "saved " + ctx.target.shorthand };
          },
        }],
      };`,
    );

    const runtime = await loadPluginRuntime({ repoPath, client: createStubClient() });
    const output: string[] = [];
    const module = createExtensionCommandModule(runtime, "project-1", "extension-lab/save-state", {
      createClient: createStubClient,
      stdout: (message) => output.push(message),
    });

    await module.handler({
      ticket: "PS-1",
      note: "hello",
      count: 2,
      enabled: true,
      mode: "fast",
    });

    expect(output).toEqual(["saved PS-1"]);

    const stored = JSON.parse(
      readFileSync(join(repoPath, ".pstdio", "extensions", ".storage", "extension-lab.json"), "utf8"),
    );
    expect(stored.last).toEqual({
      target: "PS-1",
      params: {
        note: "hello",
        count: 2,
        enabled: true,
        mode: "fast",
      },
    });
  });

  test("wraps command errors with extension and command ids", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "extension-lab.ts"),
      `export default {
        commands: [{
          key: "boom",
          path: "lab boom",
          description: "Boom",
          targetType: "project",
          run() {
            throw new Error("kaboom");
          },
        }],
      };`,
    );

    const runtime = await loadPluginRuntime({ repoPath, client: createStubClient() });
    const module = createExtensionCommandModule(runtime, "project-1", "extension-lab/boom", {
      createClient: createStubClient,
      stdout: () => {},
    });

    await expect(module.handler({})).rejects.toThrow("Extension command failed (extension-lab/boom): kaboom");
  });

  test("prevents recursive command execution", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "extension-lab.ts"),
      `export default {
        commands: [{
          key: "loop",
          path: "lab loop",
          description: "Loop",
          targetType: "project",
          async run(ctx) {
            await ctx.commands.run("loop");
          },
        }],
      };`,
    );

    const runtime = await loadPluginRuntime({ repoPath, client: createStubClient() });
    const module = createExtensionCommandModule(runtime, "project-1", "extension-lab/loop", {
      createClient: createStubClient,
      stdout: () => {},
    });

    await expect(module.handler({})).rejects.toThrow("Recursive extension command execution is not allowed");
  });

  test("wraps ticket target resolution errors with extension and command ids", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "extension-lab.ts"),
      `export default {
        commands: [{
          key: "needs-ticket",
          path: "lab needs-ticket",
          description: "Needs ticket",
          targetType: "ticket",
          run() {},
        }],
      };`,
    );

    const runtime = await loadPluginRuntime({ repoPath, client: createStubClient() });
    const module = createExtensionCommandModule(runtime, "project-1", "extension-lab/needs-ticket", {
      createClient: createStubClient,
      stdout: () => {},
    });

    await expect(module.handler({ ticket: "PS-404" })).rejects.toThrow(
      "Extension command failed (extension-lab/needs-ticket): Ticket not found for ref: PS-404",
    );
  });

  test("resolves nested extension command chaining within the same extension identity", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins", "nested");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "extension.ts"),
      `export default {
        commands: [
          {
            key: "first",
            path: "lab nested-first",
            description: "First command",
            targetType: "project",
            async run(ctx) {
              return ctx.commands.run("second");
            },
          },
          {
            key: "second",
            path: "lab nested-second",
            description: "Second command",
            targetType: "project",
            async run(ctx) {
              await ctx.storage.set("nested", { projectId: ctx.projectId });
              return { message: "nested ok" };
            },
          },
        ],
      };`,
    );

    const runtime = await loadPluginRuntime({ repoPath, client: createStubClient() });
    const output: string[] = [];
    const module = createExtensionCommandModule(runtime, "project-1", "nested/extension/first", {
      createClient: createStubClient,
      stdout: (message) => output.push(message),
    });

    await module.handler({});

    expect(output).toEqual(["nested ok"]);

    const stored = JSON.parse(
      readFileSync(join(repoPath, ".pstdio", "extensions", ".storage", "nested", "extension.json"), "utf8"),
    );
    expect(stored.nested).toEqual({ projectId: "project-1" });
  });
});
