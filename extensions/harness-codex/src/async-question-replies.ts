import type { HarnessEventSink, QuestionResponse, ToolPart } from "@pstdio/sdk/extensions";
import { questionReplyError } from "./questions";

interface AsyncQuestionInput {
  delivery: "async";
  questions: Array<{ question: string }>;
}

const inputFor = (part: ToolPart) => part.state?.input as AsyncQuestionInput | undefined;

// The conversation owns pending and accepted questions, including requests from earlier turns.
export const createAsyncQuestionReplies = (events: HarnessEventSink) => {
  const submitting = new Set<string>();
  const find = (response: QuestionResponse) =>
    events
      .getMessages()
      .flatMap((message) => message.parts)
      .find(
        (part): part is ToolPart =>
          part.type === "tool" &&
          part.tool === "question" &&
          part.callId === response.callId &&
          inputFor(part)?.delivery === "async",
      );
  const prepare = (response: QuestionResponse) => {
    const part = find(response);
    if (!part?.callId || submitting.has(part.callId) || (part.status !== "pending" && part.status !== "running")) {
      throw questionReplyError("Codex question request is no longer pending.");
    }
    const input = inputFor(part)!;
    if (
      response.answers.length &&
      (response.answers.length !== input.questions.length || response.answers.some((answers) => !answers.length))
    ) {
      throw questionReplyError("Answer every Codex question before submitting.");
    }
    const text = input.questions
      .map(
        (question, index) =>
          `${question.question}\n${response.answers.length ? response.answers[index].join(", ") : "Skipped the question."}`,
      )
      .join("\n\n");
    const accept = () => {
      events.getMessages().forEach((message, index) => {
        if (!message.parts.some((candidate) => candidate.type === "tool" && candidate.callId === part.callId)) return;
        events.push({
          op: "replace",
          path: `/messages/${index}`,
          value: {
            ...message,
            parts: message.parts.map((candidate) =>
              candidate.type === "tool" && candidate.callId === part.callId
                ? {
                    ...candidate,
                    status: "completed",
                    state: { ...candidate.state, output: { answers: response.answers } },
                  }
                : candidate,
            ),
          },
        });
      });
    };
    return { text, accept };
  };
  const reply = async (response: QuestionResponse, send: (text: string) => Promise<unknown>) => {
    const prepared = prepare(response);
    submitting.add(response.callId!);
    try {
      await send(prepared.text);
      prepared.accept();
    } catch (error) {
      throw questionReplyError(error instanceof Error ? error.message : "Codex question answer was not accepted.");
    } finally {
      submitting.delete(response.callId!);
    }
  };
  return { find, prepare, reply };
};
