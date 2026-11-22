import { expect, mock, test } from "bun:test";
import { createHandler } from "./export";

test("exports complete conversation JSON including tool results", async () => {
  const conversation = {
    session: { id: "session", status: "in_progress" },
    messages: [{ id: "tool", role: "assistant", parts: [{ type: "tool", state: { output: "x".repeat(100_000) } }] }],
  };
  const log = mock((_message: string) => {});
  const getConversation = mock(async () => conversation as never);
  await createHandler({ getConversation, log })({ id: "session", _: [], $0: "" });
  expect(getConversation).toHaveBeenCalledWith("session");
  expect(log).toHaveBeenCalledTimes(1);
  expect(JSON.parse(log.mock.calls[0]![0]!)).toEqual(conversation);
});

test("exports fail without printing a partial result when history is unavailable", async () => {
  const log = mock((_message: string) => {});
  await expect(
    createHandler({
      getConversation: async () => {
        throw new Error("Session not found");
      },
      log,
    })({ id: "missing", _: [], $0: "" }),
  ).rejects.toThrow("Session not found");
  expect(log).not.toHaveBeenCalled();
});
