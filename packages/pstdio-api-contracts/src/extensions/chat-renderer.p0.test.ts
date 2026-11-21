import { expect, test } from "bun:test";
import { chatRendererEventSchema } from "./chat-renderer";

test("message patches require a value matching the target and operation", () => {
  const message = { id: "m", role: "assistant", parts: [{ type: "text", text: "Hi" }] };
  const valid = (patch: unknown) => chatRendererEventSchema.safeParse({ revision: 0, patch }).success;
  expect(valid({ op: "replace", path: "/messages", value: [message] })).toBe(true);
  expect(valid({ op: "add", path: "/messages/0", value: message })).toBe(true);
  expect(valid({ op: "remove", path: "/messages/0" })).toBe(true);
  expect(valid({ op: "replace", path: "/messages", value: message })).toBe(false);
  expect(valid({ op: "replace", path: "/messages/0", value: [message] })).toBe(false);
  expect(valid({ op: "add", path: "/messages/0" })).toBe(false);
  expect(valid({ op: "remove", path: "/messages" })).toBe(false);
});
