import { expect, test } from "bun:test";
import { userInputHandler } from "./channels";

test("Copilot's ask_user questions use the host question form and return the person's answer", async () => {
  const asked: unknown[] = [];
  const handler = userInputHandler(
    {
      ask: async (request) => {
        asked.push(request);
        return { answers: [["Blue"]] };
      },
    },
    () => "ask-call",
  );
  expect(await handler({ question: "Which color?", choices: ["Red", "Blue"] })).toEqual({
    answer: "Blue",
    wasFreeform: false,
  });
  expect(asked).toEqual([
    expect.objectContaining({
      toolUseId: "ask-call",
      questions: [{ question: "Which color?", options: [{ label: "Red" }, { label: "Blue" }] }],
    }),
  ]);
  const typed = userInputHandler({ ask: async () => ({ answers: [["Green"]] }) }, () => undefined);
  expect(await typed({ question: "Which color?", choices: ["Red"] })).toEqual({ answer: "Green", wasFreeform: true });
});
