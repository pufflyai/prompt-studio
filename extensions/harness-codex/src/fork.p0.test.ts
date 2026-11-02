import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCodexRuntime } from "./codex-runtime";

test("fork uses the native copy operation and releases it without starting a turn", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-fork-"));
  const log = join(root, "requests.jsonl");
  const runtime = createCodexRuntime({
    spawnProcess: (_args, options) => {
      const child = spawn(process.execPath, [fileURLToPath(new URL("./app-server-fixture.ts", import.meta.url))], {
        stdio: "pipe",
        env: { ...process.env, ...options?.env, PSTDIO_TEST_RPC_LOG: log },
      });
      return {
        stdin: child.stdin!,
        stdout: child.stdout!,
        stderr: child.stderr!,
        kill: () => {
          child.kill();
        },
        onExit: new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal }))),
      };
    },
  });
  try {
    expect(await runtime.fork({ agentSessionId: "original", cwd: root })).toBe("forked-thread");
    const requests = readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(requests.find((request) => request.method === "thread/fork")?.params).toMatchObject({
      threadId: "original",
      cwd: root,
      deferGoalContinuation: true,
    });
    expect(requests.find((request) => request.method === "thread/unsubscribe")?.params).toEqual({
      threadId: "forked-thread",
    });
    expect(requests.some((request) => request.method === "turn/start")).toBe(false);
  } finally {
    await runtime.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});
