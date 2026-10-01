import { expect, test } from "bun:test";
import { createQuestionChannel, questionInput } from "./questions";

test("keeps a native question with no choices answerable as free text", () => {
  expect(questionInput([{ id: "audience", question: "Who is it for?", isOther: false, options: null }])).toMatchObject({
    questions: [{ id: "audience", options: [], allowCustomAnswer: true }],
  });
});

for (const mode of ["stale", "incomplete", "declined"]) {
  test(`marks ${mode} answers as question rejections`, async () => {
    const channel = createQuestionChannel(
      () => {},
      () => {},
      async () => false,
    );
    channel.receive({
      id: 1,
      method: "item/tool/requestUserInput",
      params: { itemId: "question", questions: [{ id: "greeting", question: "Which greeting?" }] },
    });
    await expect(
      channel.replyQuestion({
        callId: mode === "stale" ? "expired" : "question",
        answers: mode === "incomplete" ? [] : [["Hi"]],
      }),
    ).rejects.toMatchObject({ questionRejected: true });
    await channel.close();
  });
}
