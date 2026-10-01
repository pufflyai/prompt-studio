import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

export type CodexAnswers = Record<string, { answers: string[] }>;

const recordedAnswers = (transcript: string, callId: string) => {
  for (const line of transcript.split("\n")) {
    try {
      const record = JSON.parse(line);
      const payload = record.payload;
      if (record.type === "response_item" && payload?.type === "function_call_output" && payload.call_id === callId) {
        return JSON.parse(payload.output).answers as CodexAnswers;
      }
    } catch {
      // The provider can still be appending the last transcript record.
    }
  }
};

// Temporary until app-server distinguishes accepted answers from request cleanup.
// See documentation/adrs/0052-temporary-codex-question-delivery-confirmation.md.
export const confirmQuestionReply = async (
  path: string | null,
  callId: string,
  answers: CodexAnswers,
  signal: AbortSignal,
) => {
  if (!path) return false;
  while (true) {
    const finalRead = signal.aborted;
    const actual = recordedAnswers(await readFile(path, "utf8"), callId);
    if (actual) {
      return (
        Object.keys(actual).length === Object.keys(answers).length &&
        Object.entries(answers).every(
          ([id, value]) => JSON.stringify(actual[id]?.answers) === JSON.stringify(value.answers),
        )
      );
    }
    if (finalRead) return false;
    if (signal.aborted) continue;
    await setTimeout(50, undefined, { signal }).catch(() => {});
  }
};
