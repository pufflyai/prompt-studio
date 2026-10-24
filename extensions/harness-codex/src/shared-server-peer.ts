import { PassThrough, Writable } from "node:stream";
import type { JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { createCodexRuntime } from "./codex-runtime";

const nativeResult = (
  method: string,
  params: Record<string, unknown>,
  turn: number,
  thread: number,
  recoveryActive?: boolean,
  goalStatus?: string,
) => {
  switch (method) {
    case "thread/goal/get":
      return { goal: goalStatus ? { status: goalStatus } : null };
    case "thread/start":
    case "thread/resume":
      return { thread: { id: params.threadId ?? `thread-${thread}`, path: null }, model: "native-default" };
    case "turn/start":
      return { turn: { id: `turn-${turn}`, status: "inProgress" } };
    case "thread/goal/set":
      return { goal: { status: params.status ?? "active" } };
    case "thread/read":
      return readState(String(params.threadId), recoveryActive);
    case "config/read":
      return {
        config: {
          shell_environment_policy: {
            include_only: ["PATH", "HOME", "USER_VALUE"],
            set: { USER_VALUE: "kept", PSTDIO_SESSION_ID: "stale", PSTDIO_PROJECT_ID: "stale" },
          },
        },
      };
    default:
      return {};
  }
};
const loseAcknowledgement = (method: string, lose?: boolean) => method === "turn/start" && lose;
const readState = (id: string, active?: boolean) => ({
  thread: {
    id,
    turns: active ? [{ id: "unresolved", status: "inProgress", items: [] }] : [],
  },
});
export const peer = (
  options: {
    loseTurnAck?: boolean;
    recoveryActive?: boolean;
    rejectInterrupt?: boolean;
    delayTurnStarted?: boolean;
    goalStatus?: string;
  } = {},
) => {
  let held:
    | { method: string; requested: ReturnType<typeof Promise.withResolvers<void>>; reply?: () => void }
    | undefined;
  const holdNext = (method: string) => {
    const request = { method, requested: Promise.withResolvers<void>(), reply: undefined as (() => void) | undefined };
    held = request;
    return { requested: request.requested.promise, reply: () => request.reply!() };
  };
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const spawns: Array<{ env?: Record<string, string>; cwd?: string } | undefined> = [];
  const children: Array<{ emit: (value: unknown) => void; kill: () => void }> = [];
  const deps = {
    spawnProcess: (_args: string[], spawnOptions?: { env?: Record<string, string>; cwd?: string }) => {
      spawns.push(spawnOptions);
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const exited = Promise.withResolvers<{ code: number | null; signal: string | null }>();
      const emit = (value: unknown) => stdout.write(`${JSON.stringify(value)}\n`);
      let turn = 0;
      let thread = 0;
      const respond = (m: { id: number; method: string }, result: unknown) => {
        if (held && held.method === m.method) {
          held.reply = () => emit({ id: m.id, result });
          held.requested.resolve();
          held = undefined;
          return;
        }
        if (m.method === "turn/interrupt" && options.rejectInterrupt)
          emit({ id: m.id, error: { message: "no active turn to interrupt" } });
        else emit({ id: m.id, result });
      };
      const stdin = new Writable({
        write(chunk, _encoding, done) {
          const m = JSON.parse(String(chunk));
          calls.push(m);
          if (loseAcknowledgement(m.method, options.loseTurnAck)) {
            kill();
            done();
            return;
          }
          if (m.id === undefined) {
            done();
            return;
          }
          {
            if (m.method === "turn/start") turn++;
            if (m.method === "thread/start") thread++;
            const result = nativeResult(m.method, m.params, turn, thread, options.recoveryActive, options.goalStatus);
            respond(m, result);
            if (m.method === "turn/start" && !options.delayTurnStarted)
              emit({
                method: "turn/started",
                params: { threadId: m.params.threadId, turn: { id: `turn-${turn}`, status: "inProgress" } },
              });
            if (m.method === "turn/interrupt")
              emit({
                method: "turn/completed",
                params: { threadId: m.params.threadId, turn: { id: m.params.turnId, status: "interrupted" } },
              });
          }
          done();
        },
      });
      const kill = () => {
        stdout.end();
        stderr.end();
        exited.resolve({ code: null, signal: "SIGTERM" });
      };
      children.push({ emit, kill });
      return { stdin, stdout, stderr, kill, pid: children.length, onExit: exited.promise };
    },
  };
  const runtime = createCodexRuntime(deps);

  return { runtime, calls, children, spawns, holdNext };
};
export const sink = () => {
  const messages: SessionMessage[] = [];
  return {
    getMessages: () => messages,
    push: (patch: JsonPatch) => {
      messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
    },
  };
};
