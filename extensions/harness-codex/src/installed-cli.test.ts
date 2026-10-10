import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext, JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { createCodexRuntime } from "./codex-runtime";
import { detectCodex } from "./detection";
import { discoverCodexModels } from "./models";

// Runs the harness against the Codex CLI on PATH. CI installs the minimum supported version and,
// before a release, the latest one. Nothing here needs a Codex login.
const enabled = process.env.INSTALLED_CLI_TESTS === "1";
const codexHome = mkdtempSync(join(tmpdir(), "codex-home-"));
const env = { CODEX_HOME: codexHome };
const runtime = createCodexRuntime();
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

  test("starts a thread and controls its goal through the app server", async () => {
    const input = { prompt: "", events: events(), cwd: codexHome, env };
    const worker = runtime.worker(input);
    const threadId = await worker.load(input);
    await worker.request("thread/goal/set", { threadId, objective: "Check the supported protocol" });
    expect(await worker.request("thread/goal/get", { threadId })).toMatchObject({ goal: { status: "active" } });
    await worker.request("thread/goal/set", { threadId, status: "paused" });
    expect(await worker.request("thread/goal/get", { threadId })).toMatchObject({ goal: { status: "paused" } });
    await worker.request("thread/goal/clear", { threadId });
    expect(await worker.readMessages(threadId)).toEqual([]);
  });
});
