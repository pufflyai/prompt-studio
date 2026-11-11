import { describe, expect, test } from "bun:test";
import type { HarnessApprovalChannel, HarnessBackgroundTask } from "@pstdio/sdk/extensions";
import { controlledChild, recordingSink, waitForStreamIo } from "./mocks/controlled-child";
import { resumeClaudeCodeSession, startClaudeCodeSession } from "./spawn";

const backgroundTasks = (taskIds: string[]) => ({
  type: "system",
  subtype: "background_tasks_changed",
  session_id: "session-abc",
  tasks: taskIds.map((task_id) => ({ task_id, task_type: "local_bash", description: `Run ${task_id}` })),
});

const assistantText = (text: string) => ({
  type: "assistant",
  message: { role: "assistant", content: [{ type: "text", text }] },
});

const startWithSessionId = (child: ReturnType<typeof controlledChild>["child"], approvals?: HarnessApprovalChannel) => {
  const session = startClaudeCodeSession(
    { prompt: "Hello", events: recordingSink().sink, approvals },
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

  test("reports a turn that ends with background tasks running as idle, and the next turn as busy", async () => {
    const { child, stdinEnded, emit } = controlledChild();
    const turns: (HarnessBackgroundTask[] | "busy")[] = [];
    const session = resumeClaudeCodeSession(
      {
        agentSessionId: "session-abc",
        prompt: "Start the watcher",
        messageOffset: 0,
        events: recordingSink().sink,
        turns: { idle: ({ backgroundTasks }) => turns.push(backgroundTasks), busy: () => turns.push("busy") },
      },
      { spawnProcess: () => child },
    );

    emit(backgroundTasks(["watcher"]));
    emit(assistantText("Should I open a PR?"));
    emit({ type: "result", usage: {} });
    await waitForStreamIo();
    expect(turns).toEqual([[{ id: "watcher", description: "Run watcher" }]]);

    // A second task while idle updates the list; Claude still waits for the person.
    emit(backgroundTasks(["watcher", "checks"]));
    // A background subagent's output belongs to its task, not to a new main turn.
    emit({ ...assistantText("Checking the PR."), parent_tool_use_id: "toolu_agent" });
    await waitForStreamIo();
    expect(turns.at(-1)).toEqual([
      { id: "watcher", description: "Run watcher" },
      { id: "checks", description: "Run checks" },
    ]);

    emit({ type: "system", subtype: "init", session_id: "session-abc" });
    emit(assistantText("The checks passed."));
    emit({ type: "result", usage: {} });
    await waitForStreamIo();
    expect(turns.slice(-2)).toEqual([
      "busy",
      [
        { id: "watcher", description: "Run watcher" },
        { id: "checks", description: "Run checks" },
      ],
    ]);
    expect(stdinEnded()).toBe(false);

    emit(backgroundTasks([]));
    emit({ type: "system", subtype: "init", session_id: "session-abc" });
    emit({ type: "result", usage: {} });
    await waitForStreamIo();
    expect(turns.at(-1)).toBe("busy");
    expect(stdinEnded()).toBe(true);

    child.exit();
    await session.done;
  });

  test("denies tool requests when no approval channel is attached, without claiming the person refused", async () => {
    const { child, written, emit } = controlledChild();
    const session = await startWithSessionId(child);

    emit({
      type: "control_request",
      request_id: "req-1",
      request: { subtype: "can_use_tool", tool_name: "Bash", input: {}, tool_use_id: "toolu_1" },
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

  test("tells Claude an approval timed out instead of claiming the person refused", async () => {
    const { child, written, emit } = controlledChild();
    const approvals: HarnessApprovalChannel = {
      requestApproval: async (request) => ({ id: request.id, decision: "timeout" }),
    };
    const session = await startWithSessionId(child, approvals);

    emit({
      type: "control_request",
      request_id: "req-timeout",
      request: { subtype: "can_use_tool", tool_name: "Bash", input: {}, tool_use_id: "toolu_timeout" },
    });
    await waitForStreamIo();

    expect(written().at(-1)).toMatchObject({
      type: "control_response",
      response: {
        request_id: "req-timeout",
        response: { behavior: "deny", message: "Approval timed out.", interrupt: false },
      },
    });
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
