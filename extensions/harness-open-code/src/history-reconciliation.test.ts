import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { composeOpencodeSnapshot } from "./history-reconciliation";
import { normalizeOpencodeMessage } from "./opencode-normalizer";

const user: SessionMessage = { id: "user-1", role: "user", parts: [{ type: "text", text: "hello" }] };
const reply: SessionMessage = { id: "reply-1", role: "assistant", parts: [{ type: "text", text: "world" }] };
const failure: SessionMessage = {
  id: "opencode-error-session-2",
  role: "system",
  parts: [{ type: "error", errorType: "other", message: "failed" }],
};

test("an authoritative snapshot keeps generated errors on surviving turns", () => {
  expect(composeOpencodeSnapshot([user, reply, failure], [user, reply])).toEqual([user, reply, failure]);
});

test("provider removals discard provider content and metadata belonging to removed turns", () => {
  expect(composeOpencodeSnapshot([user, reply, failure], [])).toEqual([]);
  expect(composeOpencodeSnapshot([user, reply, failure], [user])).toEqual([user, failure]);
  const next: SessionMessage = { ...user, id: "user-2", parts: [{ type: "text", text: "other" }] };
  expect(composeOpencodeSnapshot([user, reply, failure, next], [next])).toEqual([next]);
});

test("provider errors are not mistaken for generated host errors", () => {
  expect(composeOpencodeSnapshot([user, { ...failure, id: "provider-error" }], [user])).toEqual([user]);
});

test("a new native turn with the same prompt cannot inherit a removed turn's metadata", () => {
  const normalize = (id: string) =>
    normalizeOpencodeMessage({ info: { id, role: "user" }, parts: [{ type: "text", text: "again" }] }, 0);
  const old = normalize("msg_old");
  old.parts.push({ type: "file", fileId: "old-file", url: "/old-file" });
  const next = normalize("msg_new");
  expect(composeOpencodeSnapshot([old, failure], [next])).toEqual([next]);
});
