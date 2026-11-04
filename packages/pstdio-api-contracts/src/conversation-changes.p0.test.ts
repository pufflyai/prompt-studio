import { expect, test } from "bun:test";
import { publishConversationChanges } from "./conversation-changes";
import type { JsonPatch } from "./harness";
import type { SessionMessage } from "./session-messages";

const message = (id: string, text = id): SessionMessage => ({ id, role: "assistant", parts: [{ type: "text", text }] });

test("a long conversation publishes only changed messages including earlier tool results", () => {
  const before = Array.from({ length: 500 }, (_, index) => message(String(index)));
  const after = [...before];
  after[1] = message("1", "updated earlier tool result");
  after.push(message("new"));
  const patches: JsonPatch[] = [];
  publishConversationChanges({ getMessages: () => before, push: (patch) => patches.push(patch) }, after);
  expect(patches.map((patch) => [patch.op, patch.path])).toEqual([
    ["replace", "/messages/1"],
    ["add", "/messages/500"],
  ]);
  expect(JSON.stringify(patches).length).toBeLessThan(500);
});

test("indexed insertions, deletions and attachments converge without whole-history replacements", () => {
  const current = [message("removed"), message("keep"), message("later")];
  const next = [
    message("keep"),
    { ...message("inserted"), parts: [{ type: "file" as const, fileId: "file", url: "/file" }] },
    message("later"),
  ];
  const operations: JsonPatch[] = [];
  const sink = {
    getMessages: () => current,
    push: (patch: JsonPatch) => {
      operations.push(patch);
      const index = Number(patch.path.split("/").at(-1));
      if (patch.op === "remove") current.splice(index, 1);
      else if (patch.op === "add") current.splice(index, 0, patch.value as SessionMessage);
      else current[index] = patch.value as SessionMessage;
    },
  };
  publishConversationChanges(sink, next);
  expect(current).toEqual(next);
  expect(operations.every((patch) => patch.path !== "/messages")).toBe(true);
  operations.length = 0;
  publishConversationChanges(sink, next);
  expect(operations).toHaveLength(0);
});
