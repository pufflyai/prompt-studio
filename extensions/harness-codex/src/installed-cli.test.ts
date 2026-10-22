import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
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
afterAll(() => runtime.dispose());

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
  test("is detected as supported", async () => {
    expect(await detectCodex(context)).toMatchObject({ available: true });
  });

  test("lists its models", async () => {
    expect((await discoverCodexModels()).length).toBeGreaterThan(0);
  });

  test("retains Fast speed and accepts an explicit switch to Standard", async () => {
    const input = {
      prompt: "",
      events: events(),
      cwd: codexHome,
      env: { ...env, PSTDIO_SESSION_ID: "speed" },
      params: { service_tier: "fast" },
    };
    const worker = runtime.worker(input);
    const threadId = await worker.load(input);
    // Empty threads have no rollout to resume; a paused goal persists one without a model turn.
    await worker.request("thread/goal/set", { threadId, objective: "Check speed", status: "paused" });
    const fast = (await worker.request("thread/resume", { threadId })) as { serviceTier: string };
    expect(["fast", "priority"]).toContain(fast.serviceTier);
    await worker.request("thread/unsubscribe", { threadId });
    expect(await worker.request("thread/resume", { threadId, serviceTier: "default" })).toMatchObject({
      serviceTier: "default",
    });
    await worker.request("thread/settings/update", { threadId, serviceTier: "fast" });
    const warm = (await worker.request("thread/resume", { threadId })) as { serviceTier: string };
    expect(["fast", "priority"]).toContain(warm.serviceTier);
    await worker.request("thread/settings/update", { threadId, serviceTier: "default" });
    expect(await worker.request("thread/resume", { threadId })).toMatchObject({ serviceTier: "default" });
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
