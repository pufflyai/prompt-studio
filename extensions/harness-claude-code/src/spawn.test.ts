import { describe, expect, test } from "bun:test";
import { PassThrough, Writable } from "node:stream";
import type { HarnessEventSink, JsonPatch } from "@pstdio/sdk/extensions";
import {
  buildResumeArgs,
  buildStartSessionArgs,
  resumeClaudeCodeSession,
  type SpawnDeps,
  startClaudeCodeSession,
} from "./spawn";

const recordingSink = () => {
  const patches: JsonPatch[] = [];
  const sink: HarnessEventSink = { push: (patch) => patches.push(patch) };
  return { patches, sink };
};

const createMockSpawnDeps = (stdoutLines: string[], options?: { delayMs?: number }): SpawnDeps => {
  const stdout = new PassThrough();
  const stdin = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    const writeLines = async () => {
      const delay = options?.delayMs ?? 5;

      for (const line of stdoutLines) {
        await new Promise((r) => setTimeout(r, delay));
        stdout.write(`${line}\n`);
      }

      await new Promise((r) => setTimeout(r, delay));
      stdout.end();
      resolve({ code: 0, signal: null });
    };

    writeLines();
  });

  return {
    spawnProcess: () => ({
      stdin,
      stdout,
      stderr: new PassThrough(),
      kill: () => {},
      onExit,
    }),
  };
};

describe("arg building", () => {
  test("uses the host-owned permission mode", () => {
    const args = buildStartSessionArgs({ model: null });

    expect(args).toContain("--permission-mode");
    expect(args.at(args.indexOf("--permission-mode") + 1)).toBe("bypassPermissions");
  });

  test("ignores permission-mode params from stale callers", () => {
    const startArgs = buildStartSessionArgs({ model: "sonnet", params: { "permission-mode": "plan" } });
    const resumeArgs = buildResumeArgs({ agentSessionId: "session-abc", model: null });

    expect(startArgs.at(startArgs.indexOf("--permission-mode") + 1)).toBe("bypassPermissions");
    expect(startArgs.slice(-2)).toEqual(["--model", "sonnet"]);
    expect(resumeArgs.at(resumeArgs.indexOf("--permission-mode") + 1)).toBe("bypassPermissions");
    expect(resumeArgs.slice(0, 2)).toEqual(["--resume", "session-abc"]);
  });

  test("maps every thinking level to start and resume effort args", () => {
    for (const thinking of ["low", "medium", "high", "xhigh", "max"]) {
      const startArgs = buildStartSessionArgs({ model: null, params: { thinking } });
      const resumeArgs = buildResumeArgs({ agentSessionId: "session-abc", model: null, params: { thinking } });

      expect(startArgs.at(startArgs.indexOf("--effort") + 1)).toBe(thinking);
      expect(resumeArgs.at(resumeArgs.indexOf("--effort") + 1)).toBe(thinking);
    }
  });
});

describe("startClaudeCodeSession", () => {
  test("extracts the agent session id, streams events, and completes on clean exit", async () => {
    const lines = [
      JSON.stringify({ type: "system", session_id: "session-abc" }),
      JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } }),
      JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "world" } }),
      JSON.stringify({ type: "result", usage: { input_tokens: 10, output_tokens: 5 } }),
    ];

    const deps = createMockSpawnDeps(lines);
    const { patches, sink } = recordingSink();

    const session = await startClaudeCodeSession({ prompt: "Hello", events: sink }, deps);

    expect(session.agentSessionId).toBe("session-abc");
    expect(session.timeoutStrategy).toBe("activity");
    expect(await session.done).toEqual({ status: "completed" });

    expect(patches.length).toBeGreaterThanOrEqual(2);
    const userPatch = patches[0];
    expect(userPatch.op).toBe("add");
    expect(userPatch.path).toBe("/messages/0");
    expect((userPatch.value as { role: string }).role).toBe("user");
    expect((userPatch.value as { createdAt?: number }).createdAt).toEqual(expect.any(Number));
  });

  test("forwards env vars to the spawned process", async () => {
    const stdout = new PassThrough();
    const stdin = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    const spawnOptions: Array<{ cwd?: string; env?: Record<string, string> }> = [];
    const deps: SpawnDeps = {
      spawnProcess: (_args, options) => {
        spawnOptions.push(options ?? {});
        queueMicrotask(() => {
          stdout.write(`${JSON.stringify({ type: "system", session_id: "session-abc" })}\n`);
          stdout.end();
        });

        return {
          stdin,
          stdout,
          stderr: new PassThrough(),
          kill: () => {},
          onExit: Promise.resolve({ code: 0, signal: null }),
        };
      },
    };

    await startClaudeCodeSession(
      { prompt: "Hello", env: { PSTDIO_SESSION_ID: "s_123" }, events: recordingSink().sink },
      deps,
    );

    expect(spawnOptions[0]?.env?.PSTDIO_SESSION_ID).toBe("s_123");
  });

  test("maps SIGTERM exits to cancelled", async () => {
    const stdout = new PassThrough();
    const deps: SpawnDeps = {
      spawnProcess: () => {
        queueMicrotask(() => {
          stdout.write(`${JSON.stringify({ type: "system", session_id: "session-abc" })}\n`);
          stdout.end();
        });
        return {
          stdin: new Writable({
            write(_chunk, _encoding, callback) {
              callback();
            },
          }),
          stdout,
          stderr: new PassThrough(),
          kill: () => {},
          onExit: Promise.resolve({ code: null, signal: "SIGTERM" }),
        };
      },
    };

    const session = await startClaudeCodeSession({ prompt: "Hello", events: recordingSink().sink }, deps);

    expect(await session.done).toEqual({ status: "cancelled" });
  });
});

describe("resumeClaudeCodeSession", () => {
  test("spawns Claude with resume session arguments", async () => {
    const stdout = new PassThrough();
    const argsList: string[][] = [];
    const deps: SpawnDeps = {
      spawnProcess: (args) => {
        argsList.push(args);
        return {
          stdin: new Writable({
            write(_chunk, _encoding, callback) {
              callback();
            },
          }),
          stdout,
          stderr: new PassThrough(),
          kill: () => {},
          onExit: Promise.resolve({ code: 0, signal: null }),
        };
      },
    };

    const session = resumeClaudeCodeSession(
      { agentSessionId: "session-abc", prompt: "Follow up", messageOffset: 0, events: recordingSink().sink },
      deps,
    );

    stdout.end();
    await session.done;

    const args = argsList[0] ?? [];
    expect(args.slice(0, 2)).toEqual(["--resume", "session-abc"]);
    expect(args).toContain("stream-json");
    expect(args).toContain("--input-format");
    expect(args).toContain("--permission-prompt-tool");
    expect(args).toContain("stdio");
  });

  test("pushes user message and streams assistant events at the message offset", async () => {
    const lines = [
      JSON.stringify({ type: "system", session_id: "session-abc" }),
      JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "Resumed reply" } }),
      JSON.stringify({ type: "result", usage: { input_tokens: 20, output_tokens: 10 } }),
    ];

    const deps = createMockSpawnDeps(lines);
    const { patches, sink } = recordingSink();

    const session = resumeClaudeCodeSession(
      { agentSessionId: "session-abc", prompt: "Follow up", messageOffset: 5, events: sink },
      deps,
    );

    expect(await session.done).toEqual({ status: "completed" });

    const userPatch = patches[0];
    expect(userPatch.op).toBe("add");
    expect(userPatch.path).toBe("/messages/5");
    expect((userPatch.value as { role: string }).role).toBe("user");
    expect((userPatch.value as { createdAt?: number }).createdAt).toEqual(expect.any(Number));

    const textPatch = patches[1];
    expect(textPatch.op).toBe("add");
    expect(textPatch.path).toBe("/messages/6");
    expect((textPatch.value as { parts: Array<{ type: string; text: string }> }).parts[0].text).toBe("Resumed reply");

    const usagePatch = patches[2];
    expect(usagePatch.path).toBe("/messages/7");
    expect((usagePatch.value as { parts: Array<{ type: string }> }).parts[0].type).toBe("token_usage");
  });

  test("closes stdin after writing the follow-up prompt", async () => {
    let stdinEnded = false;
    const stdout = new PassThrough();
    const stdin = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
      final(callback) {
        stdinEnded = true;
        callback();
      },
    });

    const session = resumeClaudeCodeSession(
      { agentSessionId: "session-abc", prompt: "Follow up", messageOffset: 0, events: recordingSink().sink },
      {
        spawnProcess: () => ({
          stdin,
          stdout,
          stderr: new PassThrough(),
          kill: () => {},
          onExit: Promise.resolve({ code: 0, signal: null }),
        }),
      },
    );

    stdout.end();
    await session.done;

    expect(stdinEnded).toBe(true);
  });

  test("handles thinking/reasoning events during resume", async () => {
    const lines = [
      JSON.stringify({ type: "content_block_start", content_block: { type: "thinking", thinking: "" } }),
      JSON.stringify({ type: "content_block_delta", delta: { type: "thinking_delta", thinking: "Let me think..." } }),
      JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "Here's my answer" } }),
    ];

    const deps = createMockSpawnDeps(lines);
    const { patches, sink } = recordingSink();

    const session = resumeClaudeCodeSession(
      { agentSessionId: "session-abc", prompt: "Think about this", messageOffset: 0, events: sink },
      deps,
    );

    await session.done;

    const types = patches
      .filter((p) => p.path.startsWith("/messages/"))
      .map((p) => (p.value as { parts: Array<{ type: string }> }).parts[0]?.type);

    expect(types).toContain("reasoning");
    expect(types).toContain("text");
  });

  test("preserves streamed TodoWrite input when the tool result replaces the pending tool", async () => {
    const todos = [
      { content: "Pick the component", status: "completed" },
      { content: "Wire the form", status: "in_progress" },
    ];
    const lines = [
      JSON.stringify({
        type: "content_block_start",
        content_block: { type: "tool_use", id: "call-1", name: "TodoWrite", input: { todos } },
      }),
      JSON.stringify({
        type: "content_block_start",
        content_block: { type: "tool_result", tool_use_id: "call-1", content: "Todos updated", is_error: false },
      }),
    ];

    const deps = createMockSpawnDeps(lines);
    const { patches, sink } = recordingSink();

    const session = resumeClaudeCodeSession(
      { agentSessionId: "session-abc", prompt: "Update todos", messageOffset: 0, events: sink },
      deps,
    );

    await session.done;

    const toolPatch = patches
      .filter((patch) => patch.op === "replace")
      .find((patch) => {
        const message = patch.value as { parts?: Array<{ type: string; tool?: string }> };
        return message.parts?.[0]?.type === "tool" && message.parts[0].tool === "TodoWrite";
      });

    expect(toolPatch?.value).toMatchObject({
      parts: [
        {
          type: "tool",
          tool: "TodoWrite",
          actionType: "write",
          status: "completed",
          state: { input: { todos }, output: "Todos updated" },
        },
      ],
    });
  });
});
