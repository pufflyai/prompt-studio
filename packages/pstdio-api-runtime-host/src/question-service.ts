import type { HarnessQuestionRequest, QuestionResponse, QuestionService } from "pstdio-api-contracts";

type PendingQuestion = {
  resolve: (response: QuestionResponse) => void;
  reject: (error: Error) => void;
  questionCount: number;
};

/** Each hook may be async; the service waits for it before the next one runs. */
export type QuestionServiceHooks = {
  /** A question opened. The host moves the session to `awaiting_input`. */
  onAsk: () => unknown;
  /** Every open question was answered. The host moves the session back to `in_progress`. */
  onAnswer: () => unknown;
};

const responseFor = (response: QuestionResponse | string, pending: PendingQuestion) => {
  if (typeof response !== "string") return response;
  return { answers: Array.from({ length: pending.questionCount }, () => [response]) };
};

const sessionEnded = () => new Error("The session ended before the question was answered.");

export const createQuestionService = (hooks: QuestionServiceHooks): QuestionService => {
  const pending = new Map<string, PendingQuestion>();
  let disposed = false;

  // Both hooks write session status, so they have to land in the order they were called, and a
  // hook queued before the session ended must not write a status after its last one.
  let notifications: Promise<unknown> = Promise.resolve();
  const notify = (run: () => unknown) => {
    notifications = notifications.then(() => (disposed ? undefined : run())).catch(() => undefined);
  };

  const ask = (request: HarnessQuestionRequest) =>
    new Promise<QuestionResponse>((resolve, reject) => {
      // Nothing will reject this later, so a closed channel has to answer the ask itself.
      if (disposed) {
        reject(sessionEnded());
        return;
      }

      pending.set(request.id, { resolve, reject, questionCount: request.questions.length });
      notify(hooks.onAsk);
    });

  const answer = (response: QuestionResponse | string) => {
    if (pending.size === 0) return false;

    const answered = [...pending];
    // The ask stays open until the session is back to `in_progress`, so a second answer still
    // takes this path instead of starting a new run, and a harness that finishes the turn right
    // away still writes the last status of the run.
    notify(async () => {
      try {
        await hooks.onAnswer();
      } finally {
        for (const [id, entry] of answered) {
          pending.delete(id);
          entry.resolve(responseFor(response, entry));
        }
      }
    });
    return true;
  };

  const hasPending = () => pending.size > 0;

  const dispose = () => {
    disposed = true;
    for (const [id, entry] of pending) {
      pending.delete(id);
      entry.reject(sessionEnded());
    }
  };

  return { ask, answer, hasPending, dispose };
};
