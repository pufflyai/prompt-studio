import { describe, expect, test } from "bun:test";
import { PassThrough, Writable } from "node:stream";
import type { HarnessEventSink, JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { buildResumeArgs, buildStartArgs, resumeCodexSession, type SpawnDeps, startCodexSession } from "./spawn";

const recordingSink = () => {
  const patches: JsonPatch[] = [];
  const sink: HarnessEventSink = { push: (patch) => patches.push(patch) };
  return { patches, sink };
};

const collectingStdin = () => {
  const chunks: string[] = [];
  let ended = false;
  const stdin = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
    final(callback) {
      ended = true;
      callback();
    },
  });
  return { stdin, chunks, isEnded: () => ended };
};

const createMockSpawnDeps = (stdoutLines: string[]) => {
  const stdout = new PassThrough();
  const { stdin, chunks, isEnded } = collectingStdin();
  const spawnCalls: Array<{ args: string[]; options?: { cwd?: string; env?: Record<string, string> } }> = [];

  const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    const writeLines = async () => {
      for (const line of stdoutLines) {
        await new Promise((r) => setTimeout(r, 2));
        stdout.write(`${line}\n`);
      }
      stdout.end();
      resolve({ code: 0, signal: null });
    };
    writeLines();
  });

  const deps: SpawnDeps = {
    spawnProcess: (args, options) => {
      spawnCalls.push({ args, options });
      return { stdin, stdout, stderr: new PassThrough(), kill: () => {}, onExit };
    },
  };

  return { deps, spawnCalls, chunks, isEnded };
};

describe("arg building", () => {
  test("start runs codex exec with JSONL output and the prompt on stdin", () => {
    const args = buildStartArgs({ model: "gpt-5.5" });

    expect(args[0]).toBe("exec");
    expect(args).toContain("--json");
    expect(args).toContain("--skip-git-repo-check");
    expect(args).toContain("--dangerously-bypass-approvals-and-sandbox");
    expect(args.slice(-3)).toEqual(["--model", "gpt-5.5", "-"]);
  });

  test("resume places global flags before the resume subcommand", () => {
    const args = buildResumeArgs({ agentSessionId: "thread-1", model: null });

    expect(args.slice(-3)).toEqual(["resume", "thread-1", "-"]);
    expect(args.indexOf("--json")).toBeLessThan(args.indexOf("resume"));
  });
});

describe("startCodexSession", () => {
  test("extracts the thread id, streams patches, and completes on clean exit", async () => {
    const { deps, chunks, isEnded } = createMockSpawnDeps([
      JSON.stringify({ type: "thread.started", thread_id: "thread-abc" }),
      JSON.stringify({ type: "turn.started" }),
      JSON.stringify({ type: "item.completed", item: { id: "item_0", type: "agent_message", text: "hello" } }),
      JSON.stringify({ type: "turn.completed", usage: { input_tokens: 10, output_tokens: 5 } }),
    ]);
    const { patches, sink } = recordingSink();

    const session = await startCodexSession({ prompt: "Say hello", events: sink }, deps);

    expect(session.agentSessionId).toBe("thread-abc");
    expect(session.timeoutStrategy).toBe("activity");
    expect(await session.done).toEqual({ status: "completed" });

    expect(chunks.join("")).toBe("Say hello");
    expect(isEnded()).toBe(true);

    expect(patches[0]).toMatchObject({ op: "add", path: "/messages/0" });
    expect((patches[0].value as SessionMessage).role).toBe("user");
    expect((patches[0].value as SessionMessage).createdAt).toEqual(expect.any(Number));
    expect((patches[1].value as SessionMessage).parts[0]).toMatchObject({ type: "text", text: "hello" });
    expect((patches[2].value as SessionMessage).parts[0]).toMatchObject({ type: "token_usage", inputTokens: 10 });
  });

  test("forwards cwd and env to the spawned process", async () => {
    const { deps, spawnCalls } = createMockSpawnDeps([JSON.stringify({ type: "thread.started", thread_id: "t" })]);

    await startCodexSession(
      { prompt: "hi", cwd: "/tmp/repo", env: { PSTDIO_SESSION_ID: "s_1" }, events: recordingSink().sink },
      deps,
    );

    expect(spawnCalls[0]?.options?.cwd).toBe("/tmp/repo");
    expect(spawnCalls[0]?.options?.env?.PSTDIO_SESSION_ID).toBe("s_1");
  });

  test("rejects when the stream ends without a thread id", async () => {
    const { deps } = createMockSpawnDeps([JSON.stringify({ type: "error", message: "config broken" })]);

    expect(startCodexSession({ prompt: "hi", events: recordingSink().sink }, deps)).rejects.toThrow("thread id");
  });

  test("maps SIGTERM exits to cancelled", async () => {
    const stdout = new PassThrough();
    const deps: SpawnDeps = {
      spawnProcess: () => {
        queueMicrotask(() => {
          stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: "t" })}\n`);
          stdout.end();
        });
        return {
          stdin: collectingStdin().stdin,
          stdout,
          stderr: new PassThrough(),
          kill: () => {},
          onExit: Promise.resolve({ code: null, signal: "SIGTERM" }),
        };
      },
    };

    const session = await startCodexSession({ prompt: "hi", events: recordingSink().sink }, deps);

    expect(await session.done).toEqual({ status: "cancelled" });
  });
});

describe("resumeCodexSession", () => {
  test("streams patches at the message offset and keeps the agent session id", async () => {
    const { deps } = createMockSpawnDeps([
      JSON.stringify({ type: "thread.started", thread_id: "thread-abc" }),
      JSON.stringify({ type: "item.completed", item: { id: "item_0", type: "agent_message", text: "resumed" } }),
      JSON.stringify({ type: "turn.completed", usage: { input_tokens: 20, output_tokens: 7 } }),
    ]);
    const { patches, sink } = recordingSink();

    const session = resumeCodexSession(
      { agentSessionId: "thread-abc", prompt: "Follow up", messageOffset: 5, events: sink },
      deps,
    );

    expect(session.agentSessionId).toBe("thread-abc");
    expect(await session.done).toEqual({ status: "completed" });

    expect(patches[0]).toMatchObject({ op: "add", path: "/messages/5" });
    expect((patches[0].value as SessionMessage).role).toBe("user");
    expect((patches[0].value as SessionMessage).createdAt).toEqual(expect.any(Number));
    expect(patches[1]).toMatchObject({ op: "add", path: "/messages/6" });
    expect((patches[1].value as SessionMessage).parts[0]).toMatchObject({ type: "text", text: "resumed" });
  });
});
