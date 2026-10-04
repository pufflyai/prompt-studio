import { expect, test } from "bun:test";
import { resolveComposerRequest } from "./composer-request";

test("new requests wait behind the form already being handled", () => {
  const question = { callId: "question", questions: [] };
  const decision = { id: "proposal" };
  const active = { kind: "decision" as const, id: "proposal" };
  expect(resolveComposerRequest(question, decision, active)).toEqual(active);
  expect(resolveComposerRequest(question, undefined, active)).toEqual({ kind: "question", id: "question" });
});

test("native questions precede a waiting plan and the draft returns after the last request", () => {
  const question = { callId: "question", questions: [] };
  const decision = { id: "proposal" };
  expect(resolveComposerRequest(question, decision, undefined)).toEqual({ kind: "question", id: "question" });
  expect(resolveComposerRequest(undefined, decision, { kind: "question", id: "question" })).toEqual({
    kind: "decision",
    id: "proposal",
  });
  expect(resolveComposerRequest(undefined, undefined, { kind: "decision", id: "proposal" })).toBeUndefined();
});
