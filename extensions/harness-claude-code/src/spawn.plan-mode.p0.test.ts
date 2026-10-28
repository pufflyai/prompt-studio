import { expect, test } from "bun:test";
import type { HarnessQuestionRequest, QuestionResponse } from "@pstdio/sdk/extensions";
import { controlledChild, recordingSink, waitForStreamIo } from "./mocks/controlled-child";
import { resumeClaudeCodeSession, startClaudeCodeSession } from "./spawn";

const input = {
  plan: "# Plan\n\nAdd a greeting and run the tests.",
  allowedPrompts: [{ tool: "Bash", prompt: "run tests" }],
};
const tool = {
  type: "tool_use",
  id: "plan-tool",
  name: "ExitPlanMode",
  input: { allowedPrompts: input.allowedPrompts },
};

for (const resume of [false, true]) {
  test(`plan approval waits for a visible question and continues in place (resume=${resume})`, async () => {
    const { child, emit, written } = controlledChild();
    const { sink, messages } = recordingSink();
    const asks: HarnessQuestionRequest[] = [];
    const answer = Promise.withResolvers<QuestionResponse>();
    const run = {
      prompt: "Plan a greeting",
      events: sink,
      questions: {
        ask: (request: HarnessQuestionRequest) => {
          asks.push(request);
          return answer.promise;
        },
      },
    };
    const pending = resume
      ? resumeClaudeCodeSession({ ...run, agentSessionId: "session" }, { spawnProcess: () => child })
      : startClaudeCodeSession(run, { spawnProcess: () => child });
    emit({ type: "system", subtype: "init", session_id: "session" });
    const session = await pending;
    emit({ type: "assistant", message: { role: "assistant", content: [tool] } });
    emit({
      type: "control_request",
      request_id: "plan",
      request: { subtype: "can_use_tool", tool_name: "ExitPlanMode", input, tool_use_id: tool.id },
    });
    await waitForStreamIo();
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ id: "plan", toolUseId: tool.id });
    const parts = messages.flatMap((message) => message.parts).filter((part) => part.type === "tool");
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      tool: "question",
      status: "pending",
      state: { input: { questions: [{ question: "Approve this plan and start implementation?" }] } },
    });
    expect(messages.flatMap((message) => message.parts)).toContainEqual({
      type: "text",
      text: `\n\n${input.plan}\n\n`,
    });
    expect(written().filter((item) => item.type === "control_response")).toHaveLength(0);
    answer.resolve({ callId: tool.id, answers: [["Approve and implement"]] });
    await waitForStreamIo();
    expect(written().at(-1).response.response).toEqual({ behavior: "allow", updatedInput: input });
    emit({
      type: "user",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: tool.id, content: "Plan approved." }] },
    });
    emit({
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "Implementing the greeting." }] },
    });
    await waitForStreamIo();
    expect(messages.flatMap((message) => message.parts)).toContainEqual(
      expect.objectContaining({ tool: "question", status: "completed" }),
    );
    child.exit();
    expect(await session.done).toEqual({ status: "completed" });
  });
}

for (const answers of [[], [["Request changes"]], [["Add a rollback step."]]]) {
  test(`keeps planning when review is not approved: ${JSON.stringify(answers)}`, async () => {
    const { child, emit, written } = controlledChild();
    const session = resumeClaudeCodeSession(
      {
        agentSessionId: "session",
        prompt: "Plan",
        events: recordingSink().sink,
        questions: { ask: async () => ({ answers }) },
      },
      { spawnProcess: () => child },
    );
    emit({
      type: "control_request",
      request_id: "plan",
      request: { subtype: "can_use_tool", tool_name: "ExitPlanMode", input, tool_use_id: tool.id },
    });
    await waitForStreamIo();
    expect(written().at(-1).response.response).toMatchObject({ behavior: "deny", interrupt: false });
    if (answers[0]?.[0] === "Add a rollback step.")
      expect(written().at(-1).response.response.message).toContain("Add a rollback step.");
    child.exit();
    await session.done;
  });
}

test("closes plan review when Claude exits and ignores a late approval", async () => {
  const { child, emit, written } = controlledChild();
  const { sink, messages } = recordingSink();
  const answer = Promise.withResolvers<QuestionResponse>();
  const session = resumeClaudeCodeSession(
    { agentSessionId: "session", prompt: "Plan", events: sink, questions: { ask: () => answer.promise } },
    { spawnProcess: () => child },
  );
  emit({
    type: "control_request",
    request_id: "plan",
    request: { subtype: "can_use_tool", tool_name: "ExitPlanMode", input, tool_use_id: tool.id },
  });
  await waitForStreamIo();
  child.exit();
  expect(await session.done).toEqual({ status: "completed" });
  expect(messages.flatMap((message) => message.parts)).toContainEqual(
    expect.objectContaining({ tool: "question", status: "failed" }),
  );
  answer.resolve({ answers: [["Approve and implement"]] });
  await waitForStreamIo();
  expect(written().filter((item) => item.type === "control_response")).toHaveLength(0);
});

for (const planInput of [{}, { plan: " \n\t" }, { plan: null }, { plan: 123 }]) {
  test(`does not offer or allow approval without a plan preview: ${JSON.stringify(planInput)}`, async () => {
    const { child, emit, written } = controlledChild();
    const { sink, messages } = recordingSink();
    const asks: HarnessQuestionRequest[] = [];
    const approvals: string[] = [];
    const session = resumeClaudeCodeSession(
      {
        agentSessionId: "session",
        prompt: "Plan",
        events: sink,
        questions: {
          ask: async (request) => {
            asks.push(request);
            return { answers: [["Approve and implement"]] };
          },
        },
        approvals: {
          requestApproval: async (request) => {
            approvals.push(request.id);
            return { id: request.id, decision: "approve" };
          },
        },
      },
      { spawnProcess: () => child },
    );
    emit({ type: "content_block_start", content_block: { ...tool, input: planInput } });
    emit({ type: "assistant", message: { role: "assistant", content: [{ ...tool, input: planInput }] } });
    await waitForStreamIo();
    expect(
      messages.flatMap((message) => message.parts).filter((part) => part.type === "tool" && part.tool === "question"),
    ).toEqual([]);
    emit({
      type: "control_request",
      request_id: "plan",
      request: { subtype: "can_use_tool", tool_name: "ExitPlanMode", input: planInput, tool_use_id: tool.id },
    });
    await waitForStreamIo();
    expect(asks).toEqual([]);
    expect(approvals).toEqual([]);
    expect(
      messages.flatMap((message) => message.parts).filter((part) => part.type === "tool" && part.tool === "question"),
    ).toEqual([]);
    expect(written().at(-1).response.response).toMatchObject({
      behavior: "deny",
      interrupt: false,
      message: expect.stringContaining("plan"),
    });
    child.exit();
    await session.done;
  });
}

test("cannot approve an unseen plan through the approval-only channel", async () => {
  const { child, emit, written } = controlledChild();
  const approvals: string[] = [];
  const session = resumeClaudeCodeSession(
    {
      agentSessionId: "session",
      prompt: "Plan",
      events: recordingSink().sink,
      approvals: {
        requestApproval: async (request) => {
          approvals.push(request.id);
          return { id: request.id, decision: "approve" };
        },
      },
    },
    { spawnProcess: () => child },
  );
  emit({
    type: "control_request",
    request_id: "plan",
    request: { subtype: "can_use_tool", tool_name: "ExitPlanMode", input: {}, tool_use_id: tool.id },
  });
  await waitForStreamIo();
  expect(approvals).toEqual([]);
  expect(written().at(-1).response.response).toMatchObject({ behavior: "deny", interrupt: false });
  child.exit();
  await session.done;
});

test("Claude can provide a visible plan after its empty request is denied", async () => {
  const { child, emit, written } = controlledChild();
  const { sink, messages } = recordingSink();
  const asks: HarnessQuestionRequest[] = [];
  const session = resumeClaudeCodeSession(
    {
      agentSessionId: "session",
      prompt: "Plan",
      events: sink,
      questions: {
        ask: async (request) => {
          asks.push(request);
          return { answers: [["Approve and implement"]] };
        },
      },
    },
    { spawnProcess: () => child },
  );
  for (const [id, planInput] of [
    ["empty", {}],
    ["visible", input],
  ] as const) {
    emit({ type: "assistant", message: { role: "assistant", content: [{ ...tool, id, input: planInput }] } });
    emit({
      type: "control_request",
      request_id: id,
      request: { subtype: "can_use_tool", tool_name: "ExitPlanMode", input: planInput, tool_use_id: id },
    });
    await waitForStreamIo();
    emit({
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: id,
            content: id === "empty" ? "No plan provided." : "Plan approved.",
            is_error: id === "empty",
          },
        ],
      },
    });
    await waitForStreamIo();
  }
  expect(asks.map((request) => request.toolUseId)).toEqual(["visible"]);
  expect(
    written()
      .filter((item) => item.type === "control_response")
      .map((item) => item.response.response.behavior),
  ).toEqual(["deny", "allow"]);
  expect(messages.flatMap((message) => message.parts)).toContainEqual(
    expect.objectContaining({ tool: "question", callId: "empty", status: "failed" }),
  );
  expect(messages.flatMap((message) => message.parts)).toContainEqual(
    expect.objectContaining({ tool: "question", callId: "visible", status: "completed" }),
  );
  child.exit();
  expect(await session.done).toEqual({ status: "completed" });
});
