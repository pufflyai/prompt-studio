import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { ApprovalResponse, HarnessApprovalChannel, HarnessQuestionChannel } from "@pstdio/sdk/extensions";
import { ASK_USER_QUESTION } from "./message-parts";
import { EXIT_PLAN_MODE, missingPlanReply, planPreview, reviewPlan } from "./plan-mode";
import { askPerson } from "./questions";
import { createSessionInput } from "./session-input";
import { type AskUserQuestionInput, parseStdoutLine, type RawLogEvent } from "./types";

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

  if (toolName === EXIT_PLAN_MODE) {
    if (!planPreview(toolInput)) return missingPlanReply();
    if (channels.questions) return reviewPlan(channels.questions, { id, toolUseId, input: toolInput });
  }

  const decision: ControlDecision = channels.approvals
    ? (await channels.approvals.requestApproval({ id, toolName, toolInput, toolUseId })).decision
    : "unavailable";
  return approvalReply(decision, toolInput);
};

// A `result` ends one turn, not the run. The run ends when a turn finishes with no background
// task left to wake Claude again, and the resulting EOF on stdin is what lets the process exit.
export async function* createRawEventStream(
  stdout: Readable,
  stdin: Writable,
  channels: ControlChannels = {},
  lifetime = createSessionInput(stdin),
): AsyncGenerator<RawLogEvent> {
  const reader = createInterface({ input: stdout, crlfDelay: Number.POSITIVE_INFINITY });

  try {
    for await (const line of reader) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parsed = parseStdoutLine(trimmed);

      if (parsed && isControlRequest(parsed)) {
        // Permission requests include plan text that the original tool call can omit.
        if ((parsed.request as Record<string, unknown>)?.tool_name === EXIT_PLAN_MODE && channels.questions) {
          yield { type: "stdout", data: trimmed };
        }
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
      const message = parsed && lifetime.observe(parsed);
      if (message) yield { type: "user_message", message };

      if (parsed && parsed.type === "system" && typeof parsed.session_id === "string") {
        yield { type: "session_id", sessionId: parsed.session_id };
        continue;
      }

      yield { type: "stdout", data: trimmed };
    }
  } finally {
    lifetime.close();
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
