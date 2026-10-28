import { expect, test } from "bun:test";
import { questionResponseSchema } from "./sessions";

test("question responses preserve a correlated call ID", () => {
  const response = { callId: "question-1", answers: [["Blue"]] };
  expect(questionResponseSchema.parse(response)).toEqual(response);
});

test("question responses still accept ordered answers without a call ID", () => {
  const response = { answers: [["Blue"], ["Small"]] };
  expect(questionResponseSchema.parse(response)).toEqual(response);
});
