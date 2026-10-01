import { expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { confirmQuestionReply } from "./question-confirmation";

test("confirms an answer persisted during a transcript read before the turn ends", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-final-answer-"));
  try {
    const path = join(root, "rollout.jsonl");
    // A long native history keeps the first read in flight while Codex appends its answer.
    writeFileSync(path, `${JSON.stringify({ padding: "x".repeat(32 * 1024 * 1024) })}\n`);
    const answers = { audience: { answers: ["Team"] } };
    const closing = new AbortController();
    const confirmed = confirmQuestionReply(path, "call-final", answers, closing.signal);
    await Bun.sleep(1);
    appendFileSync(
      path,
      `${JSON.stringify({
        type: "response_item",
        payload: {
          type: "function_call_output",
          call_id: "call-final",
          output: JSON.stringify({ answers }),
        },
      })}\n`,
    );
    closing.abort();
    expect(await confirmed).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
