import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PstdioClient } from "@pstdio/sdk/client";
import { loadPluginRuntime } from "./runtime";

let tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-runtime-test-"));
  tempDirs.push(dir);
  return dir;
};

const stubClient = {} as PstdioClient;

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("loadPluginRuntime", () => {
  test("returns runtime with empty hooks and actions when no plugins exist", async () => {
    const repoPath = createTempDir();

    const runtime = await loadPluginRuntime({ repoPath, client: stubClient });

    expect(runtime.repoPath).toBe(repoPath);
    expect(runtime.client).toBe(stubClient);
    expect(runtime.actions.list()).toEqual([]);
    expect(runtime.actions.get("anything")).toBeUndefined();
  });

  test("loads plugin hooks and makes them fireable", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "test-plugin.ts"),
      `export default {
        hooks: {
          preTicketCreation: () => ({ reject: true, reason: "blocked" }),
        },
      };`,
    );

    const runtime = await loadPluginRuntime({ repoPath, client: stubClient });

    const result = await runtime.hooks.firePre("preTicketCreation", {} as never);
    expect(result.rejected).toBe(true);
    expect(result.reason).toBe("blocked");
  });

  test("loads plugin actions into the registry", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "action-plugin.ts"),
      `export default {
        actions: [{
          key: "do-thing",
          label: "Do thing",
          targetType: "ticket",
          placement: "primary",
          trigger() {},
        }],
      };`,
    );

    const runtime = await loadPluginRuntime({ repoPath, client: stubClient });

    const actions = runtime.actions.list();
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe("action-plugin/do-thing");

    const resolved = runtime.actions.get("action-plugin/do-thing");
    expect(resolved).toBeDefined();
  });

  test("calls ensureWorkspace when provided", async () => {
    const repoPath = createTempDir();
    const calls: string[] = [];

    await loadPluginRuntime({
      repoPath,
      client: stubClient,
      ensureWorkspace: async (dir) => {
        calls.push(dir);
      },
    });

    expect(calls).toEqual([join(repoPath, ".pstdio")]);
  });

  test("exposes loaded plugins list", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "my-plugin.ts"),
      `export default {
        actions: [{
          key: "greet",
          label: "Greet",
          targetType: "ticket",
          placement: "primary",
          trigger() {},
        }],
      };`,
    );

    const runtime = await loadPluginRuntime({ repoPath, client: stubClient });

    expect(runtime.plugins).toHaveLength(1);
    expect(runtime.plugins[0].identity).toBe("my-plugin");
    expect(runtime.plugins[0].filePath).toContain("my-plugin.ts");
  });

  test("returns empty plugins list when no plugins exist", async () => {
    const repoPath = createTempDir();

    const runtime = await loadPluginRuntime({ repoPath, client: stubClient });

    expect(runtime.plugins).toEqual([]);
  });

  test("post hooks fire without rejection", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "post-plugin.ts"),
      `export default {
        hooks: {
          postTicketCreation: () => {},
        },
      };`,
    );

    const runtime = await loadPluginRuntime({ repoPath, client: stubClient });

    // Should not throw
    await runtime.hooks.firePost("postTicketCreation", {} as never);
  });
});
