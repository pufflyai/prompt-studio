import { expect, test } from "bun:test";
import { createCodexRuntime } from "./codex-runtime";
import { prepareCodexOperation } from "./commands";

test("planning without a task selects the next turn without starting native work", async () => {
  const prepared = prepareCodexOperation(
    { sessionId: "one", params: {} },
    { kind: "command", text: "/plan" },
    createCodexRuntime({
      spawnProcess: () => {
        throw new Error("No model turn expected");
      },
    }),
  );
  expect(prepared.execution).toBe("control");
  expect(await prepared.invoke({ events: { push: () => {}, getMessages: () => [] } })).toMatchObject({
    kind: "completed",
    params: { collaboration_mode: "plan" },
  });
});
test("unknown Codex commands report unsupported handling instead of becoming a prompt", () => {
  expect(() =>
    prepareCodexOperation(
      { sessionId: "one" },
      { kind: "command", text: "/unknown args" },
      {} as Parameters<typeof prepareCodexOperation>[2],
    ),
  ).toThrow("does not support");
});
