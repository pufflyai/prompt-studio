import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { detectClaude } from "./detection";
import { recordingSink } from "./mocks/controlled-child";
import { discoverClaudeModels } from "./models";
import { startClaudeCodeSession } from "./spawn";

// Runs the harness against the Claude Code CLI on PATH. CI installs the minimum supported version and,
// before a release, the latest one. Nothing here needs a Claude login.
const enabled = process.env.INSTALLED_CLI_TESTS === "1";

const run: HarnessContext["process"]["run"] = async (input) => {
  const [command, ...args] = input.command;
  const result = spawnSync(command, args, { encoding: "utf8", env: { ...process.env, ...input.env } });
  return { exitCode: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
};
const context = {
  process: { run, runOrThrow: run, spawnDetached: async () => ({ pid: 0 }) },
  logger: { warn: () => {}, info: () => {}, error: () => {} },
} as unknown as HarnessContext;

describe.if(enabled)("installed Claude Code CLI", () => {
  test("is detected as supported", async () => {
    expect(await detectClaude(context)).toMatchObject({ available: true });
  });

  test("lists its models with effort levels", async () => {
    const models = await discoverClaudeModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((model) => model.paramOverrides?.thinking)).toBe(true);
  });

  // An unknown flag stops the CLI before it reports a session, so a session ID proves it accepts every argument.
  test("accepts the harness arguments and reports its session", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "claude-cli-"));
    const session = await startClaudeCodeSession({
      prompt: "Reply with the word ready.",
      cwd,
      params: { thinking: "low", permission_mode: "plan" },
      events: recordingSink().sink,
    });
    expect(session.agentSessionId).toMatch(/\S/);
    await session.done;
  }, 120_000);
});
