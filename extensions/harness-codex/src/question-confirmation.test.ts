import { expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { confirmQuestionReply } from "./question-confirmation";

test.each(["", '{"type":"unrelated"}\n'])("rejects an unconfirmed reply when a %j transcript stops growing", async (history) => {
  const root = mkdtempSync(join(tmpdir(), "codex-empty-answer-"));
  try {
    const path = join(root, "rollout.jsonl");
    writeFileSync(path, history);
    const closing = new AbortController();
    const confirmed = confirmQuestionReply(path, "call-unconfirmed", { audience: { answers: ["Team"] } }, closing.signal);
    await Bun.sleep(75);
    closing.abort();

    expect(await Promise.race([confirmed, Bun.sleep(500).then(() => null)])).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("confirms an answer whose JSONL record and Unicode text span appends", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-partial-answer-"));
  try {
    const path = join(root, "rollout.jsonl");
    writeFileSync(path, "");
    const answers = { greeting: { answers: ["Hej 🌍"] } };
    const closing = new AbortController();
    const confirmed = confirmQuestionReply(path, "call-partial", answers, closing.signal);
    const record = Buffer.from(
      `${JSON.stringify({
        type: "response_item",
        payload: {
          type: "function_call_output",
          call_id: "call-partial",
          output: JSON.stringify({ answers }),
        },
      })}\n`,
    );
    const boundary = record.indexOf(Buffer.from("🌍")) + 2;
    appendFileSync(path, record.subarray(0, boundary));
    await Bun.sleep(75);
    appendFileSync(path, record.subarray(boundary));
    closing.abort();
    expect(await confirmed).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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
