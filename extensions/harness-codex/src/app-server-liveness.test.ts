import { afterEach, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { JsonPatch } from "@pstdio/sdk/extensions";
import type { SpawnDeps } from "./codex-process";
import { createCodexRuntime } from "./codex-runtime";
import { createCodexHarness } from "./harness";

const appServer = fileURLToPath(new URL("./mocks/liveness-app-server.ts", import.meta.url));

// A real process, so a full stderr pipe blocks the app-server unless the session drains it.
const appServerDeps = (env: Record<string, string>): SpawnDeps => ({
  spawnProcess: (_args, options) => {
    const child = spawn(process.execPath, [appServer], {
      stdio: "pipe",
      cwd: options?.cwd,
      env: { ...process.env, ...options?.env, ...env },
    });
    return {
      stdin: child.stdin,
      stdout: child.stdout,
      stderr: child.stderr,
      pid: child.pid,
      kill: () => child.kill(),
      onExit: new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal }))),
    };
  },
});

const scenarios = [
  { name: "quiet work", env: {}, status: "completed" },
  { name: "stderr backpressure", env: { LIVENESS_STDERR: "1" }, status: "completed" },
  { name: "process failure", env: { LIVENESS_EXIT_CODE: "1" }, status: "disconnected" },
] as const;

let runtime: ReturnType<typeof createCodexRuntime> | undefined;
afterEach(async () => {
  await runtime?.dispose();
  runtime = undefined;
});

describe("Codex app-server liveness", () => {
  for (const operation of ["start", "resume"] as const) {
    for (const { name, env, status } of scenarios) {
      test(`${operation} preserves ${name}`, async () => {
        const patches: JsonPatch[] = [];
        const events = { getMessages: () => [], push: (patch: JsonPatch) => patches.push(patch) };
        runtime = createCodexRuntime(appServerDeps(env));
        const harness = createCodexHarness({ runtime });
        const ctx = { projectId: "liveness-test" } as Parameters<typeof harness.start>[0];
        const input = { sessionId: "liveness-session", prompt: "finish quiet work", events };
        const session =
          operation === "start"
            ? await harness.start(ctx, input)
            : await harness.resume(ctx, { ...input, agentSessionId: "quiet-thread" });

        try {
          expect(session.agentSessionId).toBe("quiet-thread");
          // The host's activity watchdog would stop quiet work, so the app-server owns completion.
          expect(session.timeoutStrategy).toBe("provider");
          expect(await session.done).toEqual({ status });
          expect(JSON.stringify(patches)).toContain("quiet work completed");
        } finally {
          await session.stop();
        }
      });
    }
  }
});
