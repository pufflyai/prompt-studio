import type { QuestionResponse } from "@pstdio/sdk/extensions";
import type { RpcMessage } from "./app-server-rpc";
import type { CodexAnswers, confirmQuestionReply } from "./question-confirmation";
import type { CodexThreadItem } from "./types";

export interface CodexQuestion {
  id: string;
  header?: string;
  question: string;
  isOther?: boolean;
  options?: Array<{ label: string; description?: string }> | null;
}

export const questionInput = (questions: CodexQuestion[]) => ({
  questions: questions.map((question) => ({
    id: question.id,
    header: question.header,
    question: question.question,
    options: question.options ?? [],
    allowCustomAnswer: !question.options?.length || Boolean(question.isOther),
    required: true,
  })),
});

export const questionAnswerText = (questions: CodexQuestion[], answers: Record<string, { answers: string[] }>) =>
  questions.map((question) => `${question.question}\n${(answers[question.id]?.answers ?? []).join(", ")}`).join("\n\n");

interface PendingQuestion {
  requestId: string | number;
  item: CodexThreadItem;
  questions: CodexQuestion[];
  submitted?: Promise<void>;
}

export const questionReplyError = (message: string) =>
  Object.assign(new Error(message), { questionRejected: true as const });

export const createQuestionChannel = (
  write: (message: RpcMessage) => void,
  publish: (item: CodexThreadItem) => void,
  confirm: (callId: string, answers: CodexAnswers, signal: AbortSignal) => ReturnType<typeof confirmQuestionReply>,
) => {
  const pending = new Map<string, PendingQuestion>();
  const closing = new AbortController();
  const unavailable = (entry: PendingQuestion) => {
    pending.delete(entry.item.id);
    publish({ ...entry.item, status: "failed", aggregated_output: "This question is no longer available." });
  };
  const receive = (message: RpcMessage) => {
    if (message.method === "item/tool/requestUserInput" && message.id !== undefined) {
      const params = message.params as { itemId: string; turnId?: string; questions: CodexQuestion[] };
      const item = {
        id: params.itemId,
        turnId: params.turnId,
        type: "question",
        status: "pending",
        input: questionInput(params.questions),
      };
      pending.set(params.itemId, { requestId: message.id, item, questions: params.questions });
      publish(item);
    }
    if (message.method === "serverRequest/resolved") {
      const entry = [...pending.values()].find((question) => question.requestId === message.params?.requestId);
      if (!entry) return;
      if (!entry.submitted) unavailable(entry);
    }
  };
  const replyQuestion = async (response: QuestionResponse) => {
    const entry = response.callId ? pending.get(response.callId) : [...pending.values()].at(-1);
    if (!entry || entry.submitted || closing.signal.aborted)
      throw questionReplyError("Codex question request is no longer pending.");
    if (
      response.answers.length > 0 &&
      (response.answers.length !== entry.questions.length || response.answers.some((answers) => answers.length === 0))
    ) {
      throw questionReplyError("Answer every Codex question before submitting.");
    }
    const answers = Object.fromEntries(
      response.answers.map((answers, index) => [entry.questions[index].id, { answers }]),
    );
    write({ id: entry.requestId, result: { answers } });
    entry.submitted = (async () => {
      try {
        if (!(await confirm(entry.item.id, answers, closing.signal)))
          throw questionReplyError("Codex question answer was not accepted.");
        pending.delete(entry.item.id);
        publish({
          ...entry.item,
          status: "completed",
          aggregated_output: questionAnswerText(entry.questions, answers),
        });
      } catch (error) {
        unavailable(entry);
        throw error;
      }
    })();
    await entry.submitted;
  };
  const close = async () => {
    closing.abort();
    const submitted: Promise<void>[] = [];
    for (const entry of pending.values()) {
      if (entry.submitted) submitted.push(entry.submitted);
      else unavailable(entry);
    }
    await Promise.allSettled(submitted);
  };
  return { receive, replyQuestion, close };
};
