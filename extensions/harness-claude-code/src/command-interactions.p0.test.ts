import { expect, test } from "bun:test";
import { prepareClaudeOperation } from "./commands";
import { controlledChild, recordingSink, waitForStreamIo } from "./mocks/controlled-child";

test.each([
  undefined,
  "existing-thread",
])("native planning commands keep interactive channels (%s)", async (agentSessionId) => {
  const { child, emit, written } = controlledChild();
  const asked: string[] = [];
  const approvals: string[] = [];
  const prepared = prepareClaudeOperation(
    { sessionId: "session", cwd: "/workspace/project", agentSessionId },
    { kind: "command", text: "/plan Add a greeting" },
    "project",
    { spawnProcess: () => child },
  );
  const pending = prepared.invoke({
    events: recordingSink().sink,
    signal: new AbortController().signal,
    questions: {
      ask: async (request) => {
        asked.push(request.id);
        return { answers: [["Hello"]] };
      },
    },
    approvals: {
      requestApproval: async (request) => {
        approvals.push(request.id);
        return { id: request.id, decision: "approve" };
      },
    },
  });
  emit({ type: "system", subtype: "init", session_id: agentSessionId ?? "new-thread" });
  const result = await pending;
  emit({
    type: "control_request",
    request_id: "question",
    request: {
      tool_name: "AskUserQuestion",
      tool_use_id: "question-tool",
      input: { questions: [{ question: "Greeting?", options: [{ label: "Hello" }, { label: "Hi" }] }] },
    },
  });
  await waitForStreamIo();
  emit({ type: "control_request", request_id: "plan", request: { tool_name: "ExitPlanMode", input: {} } });
  await waitForStreamIo();
  child.exit();
  if (result.kind === "started") await result.session.done;
  expect(asked).toEqual(["question"]);
  expect(approvals).toEqual(["plan"]);
  const replies = written().filter((item) => item.type === "control_response");
  expect(replies).toHaveLength(2);
  expect(replies.every((item) => item.response.response.behavior === "allow")).toBe(true);
});
