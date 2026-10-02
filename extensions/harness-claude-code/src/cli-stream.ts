import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { ApprovalResponse, HarnessApprovalChannel, HarnessQuestionChannel } from "@pstdio/sdk/extensions";
import { ASK_USER_QUESTION } from "./message-parts";
import { askPerson } from "./questions";
import { type AskUserQuestionInput, parseStdoutLine, type RawLogEvent } from "./types";

const formatUserMessage = (content: string) =>
  `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`;

// stdin stays open after the prompt. Claude's `result` event ends a turn, not the run: while
// stdin is open Claude waits for its own background tasks and runs another turn when one ends.
// Ending stdin here would kill those tasks and report the run as finished mid-work.
export const sendUserMessage = (stdin: Writable, content: string) => {
  stdin.write(formatUserMessage(content));
};

/** Host channels that answer Claude's control requests. */
export type ControlChannels = {
  questions?: HarnessQuestionChannel;
  approvals?: HarnessApprovalChannel;
};

const isControlRequest = (parsed: Record<string, unknown>) => parsed.type === "control_request";

type ControlDecision = ApprovalResponse["decision"] | "unavailable";

const DENY_MESSAGES: Record<Exclude<ControlDecision, "approve">, string> = {
  timeout: "Approval timed out.",
  deny: "The user doesn't want to proceed with this tool use. The tool use was rejected.",
  // No channel means nobody could be asked. Saying the person refused would be a lie Claude acts on.
  unavailable: "This session cannot ask for approval, so the tool was not run.",
};

const approvalReply = (decision: ControlDecision, input: unknown) =>
  decision === "approve"
    ? { behavior: "allow", updatedInput: input }
    : { behavior: "deny", message: DENY_MESSAGES[decision], interrupt: decision === "timeout" };

const controlResponse = (requestId: string, response: object) => ({
  type: "control_response",
  response: { subtype: "success", request_id: requestId, response },
});

const answerControlRequest = async (parsed: Record<string, unknown>, channels: ControlChannels) => {
  const id = parsed.request_id as string;
  const request = (parsed.request ?? {}) as Record<string, unknown>;
  const toolName = (request.tool_name as string) ?? "";
  const toolInput = request.input;
  const toolUseId = (request.tool_use_id as string) ?? "";

  if (toolName === ASK_USER_QUESTION && channels.questions) {
    return askPerson(channels.questions, { id, toolUseId, input: toolInput as AskUserQuestionInput });
  }

  const decision: ControlDecision = channels.approvals
    ? (await channels.approvals.requestApproval({ id, toolName, toolInput, toolUseId })).decision
    : "unavailable";
  return approvalReply(decision, toolInput);
};

// A `result` ends one turn, not the run. The run ends when a turn finishes with no background
// task left to wake Claude again, and the resulting EOF on stdin is what lets the process exit.
const createRunLifetime = (stdin: Writable) => {
  let runningBackgroundTasks = 0;

  return {
    observe(parsed: Record<string, unknown>) {
      if (parsed.type === "system" && parsed.subtype === "background_tasks_changed") {
        // Each event carries the whole list, so the newest one is the current state.
        runningBackgroundTasks = Array.isArray(parsed.tasks) ? parsed.tasks.length : 0;
      }

      if (parsed.type === "result" && runningBackgroundTasks === 0) stdin.end();
    },
    // `writable` covers both ends of the run: stdin closed by the EOF rule above, and stdin
    // destroyed because the child already exited while a reply was still being decided.
    acceptsInput: () => stdin.writable,
  };
};

export async function* createRawEventStream(
  stdout: Readable,
  stdin: Writable,
  channels: ControlChannels = {},
): AsyncGenerator<RawLogEvent> {
  const reader = createInterface({ input: stdout, crlfDelay: Number.POSITIVE_INFINITY });
  const lifetime = createRunLifetime(stdin);

  for await (const line of reader) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parsed = parseStdoutLine(trimmed);

    if (parsed && isControlRequest(parsed)) {
      // Keep reading while the person decides. The host closes an open question only after the run
      // ends, so waiting for the answer here would keep the run from ever ending if Claude exits.
      void answerControlRequest(parsed, channels)
        // Every control request gets a reply, because stdin stays open and Claude would wait forever.
        .catch((error: unknown) => ({ behavior: "deny", message: String(error), interrupt: false }))
        .then((response) => {
          // A reply that lands after the pipe closed would crash the host on an unhandled stream error.
          if (!lifetime.acceptsInput()) return;
          stdin.write(`${JSON.stringify(controlResponse(parsed.request_id as string, response))}\n`);
        });
      continue;
    }

    // Read the run state before the session_id branch below, which swallows system events.
    if (parsed) lifetime.observe(parsed);

    if (parsed && parsed.type === "system" && typeof parsed.session_id === "string") {
      yield { type: "session_id", sessionId: parsed.session_id };
      continue;
    }

    yield { type: "stdout", data: trimmed };
  }
}

export const extractSessionId = async (events: AsyncGenerator<RawLogEvent>) => {
  const buffered: RawLogEvent[] = [];

  // Use manual .next() to avoid auto-closing the generator on early return
  while (true) {
    const { value, done } = await events.next();
    if (done) break;

    if (value.type === "session_id") {
      const sessionId = value.sessionId;

      async function* remainingEvents() {
        for (const event of buffered) {
          yield event;
        }
        yield* events;
      }

      return { sessionId, remainingEvents: remainingEvents() };
    }

    buffered.push(value);
  }

  throw new Error("Claude Code stream ended without providing session_id");
};
