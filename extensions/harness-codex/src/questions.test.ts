import { expect, test } from "bun:test";
import { questionInput } from "./questions";

test("keeps a native question with no choices answerable as free text", () => {
  expect(questionInput([{ id: "audience", question: "Who is it for?", isOther: false, options: null }])).toMatchObject({
    questions: [{ id: "audience", options: [], allowCustomAnswer: true }],
  });
});
