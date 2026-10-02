import type { HarnessEventSink, HarnessQuestionChannel, QuestionResponse } from "@pstdio/sdk/extensions";
import { closeQuestionPart, isOpenQuestion } from "./message-parts";
import type { AskUserQuestionInput } from "./types";

// Claude reads this as the tool result and carries on with its turn.
const SKIPPED_MESSAGE = "The user skipped this question without answering. Continue without an answer.";

// AskUserQuestion takes one string per question, keyed by the question text. Claude accepts a
// typed answer that matches none of its options as it is, so the person's own text needs no option.
// A question with no chosen label stays out of the map, so Claude reads it as unanswered.
const withAnswers = (input: AskUserQuestionInput, response: QuestionResponse) => ({
  ...input,
  answers: Object.fromEntries(
    input.questions.flatMap((question, index) => {
      const chosen = response.answers[index] ?? [];
      return chosen.length > 0 ? [[question.question, chosen.join(", ")]] : [];
    }),
  ),
});

/** Asks the person Claude's question through the host and builds Claude's permission reply. */
export const askPerson = async (
  questions: HarnessQuestionChannel,
  request: { id: string; toolUseId: string; input: AskUserQuestionInput },
) => {
  const response = await questions.ask({
    id: request.id,
    toolUseId: request.toolUseId,
    questions: request.input.questions.map((question) => ({
      question: question.question,
      options: question.options,
      multiple: question.multiSelect === true,
    })),
  });

  // An empty list means the person skipped. A deny without interrupt delivers this message and lets
  // Claude continue; with interrupt, Claude swaps in its own rejection text and exits 1.
  if (response.answers.length === 0) return { behavior: "deny", message: SKIPPED_MESSAGE, interrupt: false };
  return { behavior: "allow", updatedInput: withAnswers(request.input, response) };
};

/**
 * Closes every question the person can no longer answer, because the Claude process that asked it
 * has ended or is about to. Left open, its form would keep replacing the composer.
 */
export const closeOpenQuestions = (events: HarnessEventSink) => {
  for (const [index, message] of events.getMessages().entries()) {
    if (!message.parts.some(isOpenQuestion)) continue;

    const parts = message.parts.map((part) => (isOpenQuestion(part) ? closeQuestionPart(part) : part));
    events.push({ op: "replace", path: `/messages/${index}`, value: { ...message, parts } });
  }
};
