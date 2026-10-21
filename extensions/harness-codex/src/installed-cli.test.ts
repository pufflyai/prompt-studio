import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext, JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { defaultSpawnProcess } from "./codex-process";
import { createCodexRuntime } from "./codex-runtime";
import { detectCodex } from "./detection";
import { discoverCodexModels } from "./models";

// Runs the harness against the Codex CLI on PATH. CI installs the minimum supported version and,
// before a release, the latest one. Nothing here needs a Codex login.
const enabled = process.env.INSTALLED_CLI_TESTS === "1";
const codexHome = mkdtempSync(join(tmpdir(), "codex-home-"));
const env = { CODEX_HOME: codexHome };
let spawns = 0;
const runtime = createCodexRuntime({
  spawnProcess: (...args) => {
    spawns++;
    return defaultSpawnProcess(...args);
  },
});
afterAll(async () => {
  await runtime.dispose();
  rmSync(codexHome, { recursive: true, force: true });
});

const run: HarnessContext["process"]["run"] = async (input) => {
  const [command, ...args] = input.command;
  const result = spawnSync(command, args, { encoding: "utf8", env: { ...process.env, ...input.env } });
  return { exitCode: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
};
const context = {
  process: { run, runOrThrow: run, spawnDetached: async () => ({ pid: 0 }) },
  logger: { warn: () => {}, info: () => {}, error: () => {} },
} as unknown as HarnessContext;
const events = () => {
  const messages: SessionMessage[] = [];
  return { getMessages: () => messages, push: (_patch: JsonPatch) => {} };
};

describe.if(enabled)("installed Codex CLI", () => {
  test("idle release stops only its MCP processes and restores the saved thread and paused goal", async () => {
    const home = mkdtempSync(join(tmpdir(), "codex-idle-home-"));
    const log = join(home, "mcp-pids");
    writeFileSync(
      join(home, "config.toml"),
      `[mcp_servers.cleanup_fixture]\ncommand = ${JSON.stringify(process.execPath)}\nargs = ${JSON.stringify([join(import.meta.dir, "mcp-process.fixture.ts"), log])}\n`,
    );
    const owned = createCodexRuntime();
    const input = (id: string) => ({
      prompt: "",
      events: events(),
      cwd: home,
      env: { CODEX_HOME: home, PSTDIO_SESSION_ID: id, PSTDIO_PROJECT_ID: "p" },
    });
    const pids = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map(Number) : []);
    const alive = (pid: number) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    try {
      const first = owned.worker(input("a"));
      const id = await first.load(input("a"));
      await first.request("mcpServerStatus/list", {});
      const firstPids = pids().filter(alive);
      await first.request("thread/goal/set", { threadId: id, objective: "Keep this persisted goal", status: "paused" });
      const second = owned.worker(input("b"));
      const otherId = await second.load(input("b"));
      await second.request("mcpServerStatus/list", {});
      const allPids = pids().filter(alive);
      const otherPids = allPids.filter((pid) => !firstPids.includes(pid));
      expect(firstPids.length).toBeGreaterThan(0);
      expect(otherPids.length).toBeGreaterThan(0);
      expect(await owned.releaseSession("p", "a")).toBe(true);
      for (let i = 0; i < 100 && firstPids.some(alive); i++) await Bun.sleep(10);
      expect(firstPids.filter(alive)).toEqual([]);
      expect(otherPids.some(alive)).toBe(true);
      expect(await second.request("thread/goal/get", { threadId: otherId })).toMatchObject({ goal: null });
      const resumedInput = { ...input("a"), agentSessionId: id };
      const resumed = owned.worker(resumedInput);
      expect(await resumed.load(resumedInput)).toBe(id);
      expect(await resumed.request("thread/goal/get", { threadId: id })).toMatchObject({
        goal: { status: "paused", objective: "Keep this persisted goal" },
      });
    } finally {
      await owned.dispose();
      rmSync(home, { recursive: true, force: true });
    }
  });
  test("is detected as supported", async () => {
    expect(await detectCodex(context)).toMatchObject({ available: true });
  });

  test("lists its models", async () => {
    expect((await discoverCodexModels()).length).toBeGreaterThan(0);
  });

  test("starts a thread and controls its goal through the app server", async () => {
    const input = {
      prompt: "",
      events: events(),
      cwd: codexHome,
      env: { ...env, PSTDIO_SESSION_ID: "first", PSTDIO_PROJECT_ID: "p" },
    };
    const worker = runtime.worker(input);
    const threadId = await worker.load(input);
    await worker.request("thread/goal/set", { threadId, objective: "Check the supported protocol" });
    expect(await worker.request("thread/goal/get", { threadId })).toMatchObject({ goal: { status: "active" } });
    await worker.request("thread/goal/set", { threadId, status: "paused" });
    expect(await worker.request("thread/goal/get", { threadId })).toMatchObject({ goal: { status: "paused" } });
    const otherInput = { ...input, env: { ...env, PSTDIO_SESSION_ID: "second" } };
    const other = runtime.worker(otherInput);
    const otherId = await other.load(otherInput);
    expect(spawns).toBe(1);
    expect(otherId).not.toBe(threadId);
    expect(await other.request("thread/goal/get", { threadId: otherId })).toMatchObject({ goal: null });
    await runtime.disposeScope("p");
    expect(other.isClosed()).toBe(false);

    await other.request("thread/goal/set", { threadId: otherId, objective: "Readback" });
    await other.request("thread/goal/set", { threadId: otherId, status: "paused" });
    await other.request("thread/goal/clear", { threadId: otherId });
    expect(await other.readMessages(otherId)).toEqual([]);
    expect(await other.readMessages(otherId)).toEqual([]);
  });
});
