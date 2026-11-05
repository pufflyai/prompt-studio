import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { detectOpencode } from "./detection";
import { createOpencodeHarness } from "./harness";

// Runs the harness against the OpenCode CLI on PATH. CI installs the minimum supported version and,
// before a release, the latest one. Nothing here needs a model or a login.
const enabled = process.env.INSTALLED_CLI_TESTS === "1";
// Keep OpenCode's sessions and settings out of the developer's own OpenCode data.
const home = mkdtempSync(join(tmpdir(), "opencode-home-"));
mkdirSync(join(home, ".opencode", "commands"), { recursive: true });
writeFileSync(
  join(home, "opencode.json"),
  JSON.stringify({ commands: { review: { template: "Review the current changes." } } }),
);
for (const dir of ["DATA", "CONFIG", "STATE", "CACHE"]) process.env[`XDG_${dir}_HOME`] = join(home, dir.toLowerCase());

const run: HarnessContext["process"]["run"] = async (input) => {
  const [command, ...args] = input.command;
  const result = spawnSync(command, args, { encoding: "utf8", env: { ...process.env, ...input.env } });
  return { exitCode: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
};
const values = new Map<string, unknown>();
const context = {
  process: { run, runOrThrow: run, spawnDetached: async () => ({ pid: 0 }) },
  state: {
    get: async (key: string) => values.get(key),
    set: async (key: string, value: unknown) => void values.set(key, value),
    delete: async (key: string) => void values.delete(key),
  },
  logger: { warn: () => {}, info: () => {}, error: () => {} },
} as unknown as HarnessContext;

describe.if(enabled)("installed OpenCode CLI", () => {
  const harness = createOpencodeHarness();
  afterAll(async () => {
    await harness.dispose!(context);
  });

  test("is detected as supported", async () => {
    expect(await detectOpencode(context)).toMatchObject({ available: true });
  });

  test("lists its models", async () => {
    expect((await harness.listModels!(context)).length).toBeGreaterThan(0);
  });

  test("keeps native free models available without sign-in", async () => {
    expect((await harness.getAuthentication!(context, { model: "opencode/big-pickle" })).status).toBe("not_required");
  });

  test("starts its server and reads OpenCode's native commands", async () => {
    const state = await harness.getCommandState!(context, { cwd: home });
    // The harness adds /compact itself; every other command comes from the OpenCode server.
    expect(state.commands.length).toBeGreaterThan(1);
  }, 5_000);
});
