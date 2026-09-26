import { expect, test } from "bun:test";
import { reconcileMessageHistory } from "./history-reconciliation";
import type { SessionMessage } from "./session-messages";

const user = (text: string): SessionMessage => ({ id: text, role: "user", parts: [{ type: "text", text }] });
const reply = (text: string): SessionMessage => ({ ...user(text), role: "assistant" });
const recover = (knownMessages: SessionMessage[], nativeMessages: SessionMessage[]) =>
  reconcileMessageHistory({ knownMessages, nativeMessages });

test("recovery preserves missing middle turns from either source", () => {
  const complete = [user("one"), reply("first"), user("two"), reply("second"), user("three"), reply("third")];
  const partial = [...complete.slice(0, 2), ...complete.slice(4)];
  expect(recover(partial, complete)).toEqual({ kind: "recovered", messages: complete });
  expect(recover(complete, partial)).toEqual({ kind: "recovered", messages: complete });
});

test("assistant evidence aligns repeated prompts around a missing middle turn", () => {
  const complete = [user("again"), reply("first"), user("again"), reply("second"), user("again"), reply("third")];
  const partial = [...complete.slice(0, 2), ...complete.slice(4)];
  expect(recover(partial, complete)).toEqual({ kind: "recovered", messages: complete });
  expect(recover(complete, partial)).toEqual({ kind: "recovered", messages: complete });
});

test("ambiguous repeated prompts do not assign saved attachments by array position", () => {
  const attached = {
    ...user("again"),
    parts: [...user("again").parts, { type: "file" as const, fileId: "file", url: "/file" }],
  };
  expect(recover([attached, user("again")], [user("again"), reply("first"), user("again"), reply("second")]).kind).toBe(
    "conflict",
  );
});

test("multi-part submitted text is preserved once", () => {
  const saved = {
    ...user("first"),
    parts: [
      { type: "text" as const, text: "first" },
      { type: "text" as const, text: "second" },
    ],
  };
  const result = recover([saved], [{ ...saved, id: "native" }]);
  expect(result).toEqual({ kind: "recovered", messages: [{ ...saved, id: "native" }] });
});

test("structured tool input order does not split one call into competing history", () => {
  const tool: SessionMessage = {
    id: "tool",
    role: "assistant",
    parts: [{ type: "tool", tool: "example", state: { input: { a: 1, b: 2 } } }],
  };
  const native: SessionMessage = {
    ...tool,
    parts: [{ type: "tool", tool: "example", state: { input: { b: 2, a: 1 } } }],
  };
  expect(recover([user("run"), tool], [user("run"), native])).toEqual({
    kind: "recovered",
    messages: [user("run"), native],
  });
});

test("recovery preserves a completed reply when the native tail is partial", () => {
  expect(recover([user("one"), reply("first")], [user("one")])).toEqual({
    kind: "recovered",
    messages: [user("one"), reply("first")],
  });
});

test("conflicting intervals return a conflict instead of guessing order", () => {
  expect(recover([user("one"), reply("a")], [user("one"), reply("b")]).kind).toBe("conflict");
  expect(recover([user("repeat"), user("repeat")], [user("repeat")]).kind).toBe("conflict");
});

test("equal repeated turns retain every occurrence and their generated usage", () => {
  const usage: SessionMessage = {
    id: "usage-0",
    role: "system",
    parts: [{ type: "token_usage", inputTokens: 1, outputTokens: 2 }],
  };
  const known = [user("repeat"), reply("answer"), usage, user("repeat"), reply("answer"), usage];
  expect(recover(known, [user("repeat"), reply("answer"), user("repeat"), reply("answer")])).toEqual({
    kind: "recovered",
    messages: known,
  });
});

test("submitted attachments and prompt survive an agent attachment manifest", () => {
  const saved = {
    ...user("one"),
    parts: [...user("one").parts, { type: "file" as const, fileId: "file", url: "/file" }],
  };
  const native = { ...user("one\n\n<session-attachments>\nfile\n</session-attachments>"), id: saved.id };
  expect(recover([saved], [native])).toEqual({ kind: "recovered", messages: [saved] });
});

test("recovered presentation indices follow final positions without changing either source", () => {
  const known = [
    { ...user("first"), index: 0 },
    { ...user("second"), index: 1 },
    { ...user("third"), index: 2 },
  ];
  const native = [known[0], { ...known[2], index: 1 }];
  const result = recover(known, native);
  expect(result.kind).toBe("recovered");
  if (result.kind === "recovered") expect(result.messages.map((message) => message.index)).toEqual([0, 1, 2]);
  expect(native[1].index).toBe(1);
});
