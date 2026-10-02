import { describe, expect, test } from "bun:test";
import type {
  ApprovalResponse,
  HarnessQuestionChannel,
  HarnessQuestionRequest,
  QuestionResponse,
  SessionMessage,
} from "@pstdio/sdk/extensions";
import { controlledChild, recordingSink, waitForStreamIo } from "./mocks/controlled-child";
import { resumeClaudeCodeSession, startClaudeCodeSession } from "./spawn";

const colorQuestion = {
  questions: [
    {
      question: "Red or blue?",
      header: "Color",
      options: [
        { label: "Red", description: "Warm" },
        { label: "Blue", description: "Cool" },
      ],
      multiSelect: false,
    },
  ],
};

const askUserQuestion = (input: object, requestId = "req-1") => ({
  type: "control_request",
  request_id: requestId,
  request: {
    subtype: "can_use_tool",
    tool_name: "AskUserQuestion",
    input,
    tool_use_id: "toolu_question",
    requires_user_interaction: true,
  },
});

const UNAVAILABLE = "This question is no longer available.";

const askToolUse = {
  type: "assistant",
  message: {
    role: "assistant",
    content: [{ type: "tool_use", id: "toolu_question", name: "AskUserQuestion", input: colorQuestion }],
  },
};

const lastQuestionPart = (messages: SessionMessage[]) =>
  messages
    .flatMap((message) => message.parts)
    .filter((part) => part.type === "tool" && part.tool === "question")
    .at(-1);

// A host channel the test answers by hand, so it can check what Claude is told while the ask is open.
const manualQuestions = () => {
  const asks: HarnessQuestionRequest[] = [];
  let answer: (response: QuestionResponse) => void = () => {};
  const channel: HarnessQuestionChannel = {
    ask: (request) => {
      asks.push(request);
      return new Promise((resolve) => {
        answer = resolve;
      });
    },
  };
  return { channel, asks, answer: (response: QuestionResponse) => answer(response) };
};

const startWithQuestions = (child: ReturnType<typeof controlledChild>["child"], questions: HarnessQuestionChannel) => {
  const session = startClaudeCodeSession(
    { prompt: "Ask me", events: recordingSink().sink, questions },
    { spawnProcess: () => child },
  );
  child.stdout.write(`${JSON.stringify({ type: "system", subtype: "init", session_id: "session-abc" })}\n`);
  return session;
};

const replyTo = (written: Array<{ response?: { request_id?: string } }>, requestId: string) =>
  written.find((reply) => reply.response?.request_id === requestId) as
    | { response: { response: Record<string, unknown> } }
    | undefined;

describe("Claude asking the person a question", () => {
  test("asks through the host channel and answers Claude in place", async () => {
    const { child, written, emit } = controlledChild();
    const questions = manualQuestions();
    const session = await startWithQuestions(child, questions.channel);

    emit(askUserQuestion(colorQuestion));
    await waitForStreamIo();

    expect(questions.asks).toEqual([
      {
        id: "req-1",
        toolUseId: "toolu_question",
        questions: [
          {
            question: "Red or blue?",
            options: [
              { label: "Red", description: "Warm" },
              { label: "Blue", description: "Cool" },
            ],
            multiple: false,
          },
        ],
      },
    ]);
    // Claude waits on the reply, so none may be written before the person answers.
    expect(replyTo(written(), "req-1")).toBeUndefined();

    questions.answer({ answers: [["Blue"]], callId: "toolu_question" });
    await waitForStreamIo();

    expect(replyTo(written(), "req-1")?.response.response).toEqual({
      behavior: "allow",
      updatedInput: { ...colorQuestion, answers: { "Red or blue?": "Blue" } },
    });
    child.exit();
    expect(await session.done).toEqual({ status: "completed" });
  });

  test("joins several choices and passes the person's own text as given", async () => {
    const { child, written, emit } = controlledChild();
    const questions = manualQuestions();
    const fruit = {
      questions: [
        {
          question: "Which fruit?",
          header: "Fruit",
          options: [
            { label: "Apple", description: "" },
            { label: "Pear", description: "" },
          ],
          multiSelect: true,
        },
      ],
    };
    const session = await startWithQuestions(child, questions.channel);

    emit(askUserQuestion(fruit));
    await waitForStreamIo();
    questions.answer({ answers: [["Apple", "Mango, ripe"]] });
    await waitForStreamIo();

    expect(replyTo(written(), "req-1")?.response.response).toEqual({
      behavior: "allow",
      updatedInput: { ...fruit, answers: { "Which fruit?": "Apple, Mango, ripe" } },
    });
    child.exit();
    await session.done;
  });

  test("tells Claude the person skipped, without interrupting its turn", async () => {
    const { child, written, emit } = controlledChild();
    const questions = manualQuestions();
    const session = await startWithQuestions(child, questions.channel);

    emit(askUserQuestion(colorQuestion));
    await waitForStreamIo();
    questions.answer({ answers: [] });
    await waitForStreamIo();

    expect(replyTo(written(), "req-1")?.response.response).toEqual({
      behavior: "deny",
      message: "The user skipped this question without answering. Continue without an answer.",
      interrupt: false,
    });
    child.exit();
    await session.done;
  });

  test("answers only the questions the person answered", async () => {
    const { child, written, emit } = controlledChild();
    const questions = manualQuestions();
    const twoQuestions = {
      questions: [colorQuestion.questions[0], { ...colorQuestion.questions[0], question: "Shade?" }],
    };
    const session = await startWithQuestions(child, questions.channel);

    emit(askUserQuestion(twoQuestions));
    await waitForStreamIo();
    questions.answer({ answers: [["Red"]] });
    await waitForStreamIo();

    expect(replyTo(written(), "req-1")?.response.response).toEqual({
      behavior: "allow",
      updatedInput: { ...twoQuestions, answers: { "Red or blue?": "Red" } },
    });
    child.exit();
    await session.done;
  });

  test("ends the run and closes the question when Claude exits while it is still open", async () => {
    const { child, written, emit } = controlledChild();
    const questions = manualQuestions();
    const { messages, sink } = recordingSink();
    const session = startClaudeCodeSession(
      { prompt: "Ask me", events: sink, questions: questions.channel },
      { spawnProcess: () => child },
    );
    emit({ type: "system", subtype: "init", session_id: "session-abc" });
    await session;

    emit(askToolUse);
    emit(askUserQuestion(colorQuestion));
    await waitForStreamIo();
    child.exit();

    // The host closes the question channel only after `done` settles, so `done` cannot wait for it.
    expect(await (await session).done).toEqual({ status: "completed" });
    expect(lastQuestionPart(messages)).toMatchObject({ status: "failed", state: { output: UNAVAILABLE } });
    questions.answer({ answers: [["Blue"]] });
    await waitForStreamIo();
    expect(replyTo(written(), "req-1")).toBeUndefined();
  });

  test("stopping the session closes an open question before the host closes the conversation", async () => {
    const { child, emit } = controlledChild();
    const { messages, sink } = recordingSink();
    let killed = false;
    const session = startClaudeCodeSession(
      { prompt: "Ask me", events: sink, questions: manualQuestions().channel },
      { spawnProcess: () => ({ ...child, kill: () => (killed = true) }) },
    );
    emit({ type: "system", subtype: "init", session_id: "session-abc" });
    const started = await session;
    emit(askToolUse);
    emit(askUserQuestion(colorQuestion));
    await waitForStreamIo();

    started.stop();

    expect(killed).toBe(true);
    expect(lastQuestionPart(messages)).toMatchObject({ status: "failed", state: { output: UNAVAILABLE } });
    child.exit();
    await started.done;
  });

  test("asks on resume as well", async () => {
    const { child, written, emit } = controlledChild();
    const questions = manualQuestions();
    const session = resumeClaudeCodeSession(
      {
        agentSessionId: "session-abc",
        prompt: "Follow up",
        messageOffset: 0,
        events: recordingSink().sink,
        questions: questions.channel,
      },
      { spawnProcess: () => child },
    );

    emit(askUserQuestion(colorQuestion));
    await waitForStreamIo();
    questions.answer({ answers: [["Red"]] });
    await waitForStreamIo();

    expect(replyTo(written(), "req-1")?.response.response).toMatchObject({ behavior: "allow" });
    child.exit();
    await session.done;
  });

  test("a resumed run closes a question the previous Claude process left open", async () => {
    const { child } = controlledChild();
    const openQuestion: SessionMessage = {
      id: "a1",
      role: "assistant",
      parts: [{ type: "tool", tool: "question", callId: "toolu_old", status: "pending", state: { input: {} } }],
    };
    const { patches, sink } = recordingSink([openQuestion]);
    const session = resumeClaudeCodeSession(
      { agentSessionId: "session-abc", prompt: "Red or blue?: Blue", messageOffset: 1, events: sink },
      { spawnProcess: () => child },
    );

    expect(patches[0]).toEqual({
      op: "replace",
      path: "/messages/0",
      value: {
        ...openQuestion,
        parts: [
          {
            type: "tool",
            tool: "question",
            callId: "toolu_old",
            status: "failed",
            state: { input: {}, output: UNAVAILABLE, errorText: UNAVAILABLE },
          },
        ],
      },
    });
    child.exit();
    await session.done;
  });

  test("sends other tool requests to the approval channel with Claude's camelCase reply", async () => {
    const { child, written, emit } = controlledChild();
    const planInput = { plan: "Ship it" };
    const session = resumeClaudeCodeSession(
      {
        agentSessionId: "session-abc",
        prompt: "Plan",
        messageOffset: 0,
        events: recordingSink().sink,
        questions: manualQuestions().channel,
        approvals: {
          requestApproval: async (request) => ({ id: request.id, decision: "approve" }) satisfies ApprovalResponse,
        },
      },
      { spawnProcess: () => child },
    );

    emit({
      type: "control_request",
      request_id: "req-plan",
      request: { subtype: "can_use_tool", tool_name: "ExitPlanMode", input: planInput, tool_use_id: "toolu_plan" },
    });
    await waitForStreamIo();

    expect(replyTo(written(), "req-plan")?.response.response).toEqual({ behavior: "allow", updatedInput: planInput });
    child.exit();
    await session.done;
  });
});
