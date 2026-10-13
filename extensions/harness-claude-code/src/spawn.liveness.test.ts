import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { recordingSink } from "./mocks/controlled-child";
import { resumeClaudeCodeSession, type SpawnDeps, startClaudeCodeSession } from "./spawn";

const cli = fileURLToPath(new URL("./mocks/liveness-cli.ts", import.meta.url));

// A real process, so a full stderr pipe blocks the CLI unless the session drains it.
const cliDeps = (env: Record<string, string>): SpawnDeps => ({
  spawnProcess: (_args, options) => {
    const child = spawn(process.execPath, [cli], {
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
  { name: "process failure", env: { LIVENESS_EXIT_CODE: "1" }, status: "failed" },
] as const;

describe("Claude process liveness", () => {
  for (const operation of ["start", "resume"] as const) {
    for (const { name, env, status } of scenarios) {
      test(`${operation} preserves ${name}`, async () => {
        const { patches, sink } = recordingSink();
        const input = { prompt: "finish quiet work", events: sink };
        const session =
          operation === "start"
            ? await startClaudeCodeSession(input, cliDeps(env))
            : await resumeClaudeCodeSession({ ...input, agentSessionId: "quiet-thread" }, cliDeps(env));

        expect(session.agentSessionId).toBe("quiet-thread");
        // The host's activity watchdog would stop quiet work, so the process exit must own completion.
        expect(session.timeoutStrategy).toBe("provider");
        expect(await session.done).toEqual({ status });
        expect(JSON.stringify(patches)).toContain("quiet work completed");
      });
    }
  }
});
