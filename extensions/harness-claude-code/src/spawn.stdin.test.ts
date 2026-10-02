import { describe, expect, test } from "bun:test";
import { controlledChild, recordingSink, waitForStreamIo } from "./mocks/controlled-child";
import { resumeClaudeCodeSession, startClaudeCodeSession } from "./spawn";

const backgroundTasks = (taskIds: string[]) => ({
  type: "system",
  subtype: "background_tasks_changed",
  session_id: "session-abc",
  tasks: taskIds.map((task_id) => ({ task_id, task_type: "local_bash" })),
});

const assistantText = (text: string) => ({
  type: "assistant",
  message: { role: "assistant", content: [{ type: "text", text }] },
});

const startWithSessionId = (child: ReturnType<typeof controlledChild>["child"]) => {
  const session = startClaudeCodeSession(
    { prompt: "Hello", events: recordingSink().sink },
    { spawnProcess: () => child },
  );
  child.stdout.write(`${JSON.stringify({ type: "system", subtype: "init", session_id: "session-abc" })}\n`);
  return session;
};

describe("Claude process stdin across turns", () => {
  test("ends stdin when a turn ends with no background task", async () => {
    const { child, stdinEnded, emit } = controlledChild();
    const session = resumeClaudeCodeSession(
      { agentSessionId: "session-abc", prompt: "Follow up", messageOffset: 0, events: recordingSink().sink },
      { spawnProcess: () => child },
    );

    emit({ type: "result", usage: {} });
    await waitForStreamIo();

    expect(stdinEnded()).toBe(true);
    child.exit();
    await session.done;
  });

  test("keeps stdin open after a turn while a background task runs", async () => {
    const { child, stdinEnded, emit } = controlledChild();
    const { patches, sink } = recordingSink();
    const session = resumeClaudeCodeSession(
      { agentSessionId: "session-abc", prompt: "Run the tests", messageOffset: 0, events: sink },
      { spawnProcess: () => child },
    );

    emit(backgroundTasks(["tests"]));
    emit(assistantText("I'll wait for the tests."));
    emit({ type: "result", usage: {} });
    await waitForStreamIo();
    expect(stdinEnded()).toBe(false);

    emit(backgroundTasks([]));
    await waitForStreamIo();
    expect(stdinEnded()).toBe(false);

    emit(assistantText("The tests passed."));
    emit({ type: "result", usage: {} });
    await waitForStreamIo();
    expect(stdinEnded()).toBe(true);

    child.exit();
    expect(await session.done).toEqual({ status: "completed" });
    expect(patches.some((patch) => JSON.stringify(patch.value).includes("The tests passed."))).toBe(true);
  });

  test("denies tool requests when no approval channel is attached, without claiming the person refused", async () => {
    const { child, written, emit } = controlledChild();
    const session = await startWithSessionId(child);

    emit({
      type: "control_request",
      request_id: "req-1",
      request: { subtype: "can_use_tool", tool_name: "ExitPlanMode", input: {}, tool_use_id: "toolu_1" },
    });
    await waitForStreamIo();

    const reply = written().at(-1);
    expect(reply).toMatchObject({
      type: "control_response",
      response: { request_id: "req-1", response: { behavior: "deny", interrupt: false } },
    });
    expect(reply.response.response.message).toBe("This session cannot ask for approval, so the tool was not run.");
    child.exit();
    await session.done;
  });

  test("does not reply to a control request that arrives after the run ended", async () => {
    const { child, stdinEnded, written, emit } = controlledChild();
    const session = resumeClaudeCodeSession(
      { agentSessionId: "session-abc", prompt: "Follow up", messageOffset: 0, events: recordingSink().sink },
      { spawnProcess: () => child },
    );

    emit({ type: "result", usage: {} });
    await waitForStreamIo();
    expect(stdinEnded()).toBe(true);

    emit({
      type: "control_request",
      request_id: "req-late",
      request: { subtype: "can_use_tool", tool_name: "Bash", input: {}, tool_use_id: "toolu_late" },
    });
    await waitForStreamIo();

    // A write to the closed pipe raises an unhandled stream error that takes the host down.
    expect(written().some((reply) => reply.response?.request_id === "req-late")).toBe(false);
    child.exit();
    expect(await session.done).toEqual({ status: "completed" });
  });
});
