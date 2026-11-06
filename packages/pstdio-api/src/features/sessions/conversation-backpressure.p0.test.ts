import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createSessionConversation } from "./session-conversation";

const message = (id: string, text = id): SessionMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text }],
});

test("a paused subscriber catches up to additions, deletions and completion without retaining intermediate payloads", async () => {
  const events = createEventStore({ maxSizeBytes: 1024 });
  const conversation = createSessionConversation(events, [message("tool"), message("deleted")]);
  const iterator = conversation.snapshotAndSubscribe().stream[Symbol.asyncIterator]();
  for (let index = 0; index < 1024; index++) {
    conversation.push({ op: "replace", path: "/messages/0", value: message("tool", `tail ${index}`) });
  }
  conversation.push({ op: "remove", path: "/messages/1" });
  conversation.push({ op: "add", path: "/messages/1", value: message("later") });
  expect(events.diagnostics().queuedBytes).toBe(0);
  conversation.push({ op: "replace", path: "/status", value: "completed" });
  conversation.close();
  expect((await iterator.next()).value).toEqual({
    op: "replace",
    path: "/messages",
    value: [message("tool", "tail 1023"), message("later")],
  });
  expect((await iterator.next()).value).toEqual({ op: "replace", path: "/status", value: "completed" });
  expect((await iterator.next()).done).toBe(true);
});

test("changes during snapshot delivery request one new snapshot and preserve approval order", async () => {
  const conversation = createSessionConversation(createEventStore({ maxSizeBytes: 1 }), [message("initial")]);
  const iterator = conversation.snapshotAndSubscribe().stream[Symbol.asyncIterator]();
  conversation.push({ op: "replace", path: "/messages/0", value: message("first") });
  expect((await iterator.next()).value).toMatchObject({ path: "/messages", value: [message("first")] });
  conversation.push({ op: "replace", path: "/approval_request", value: { id: "approval" } });
  conversation.push({ op: "replace", path: "/messages/0", value: message("latest") });
  expect((await iterator.next()).value).toMatchObject({ path: "/approval_request", value: { id: "approval" } });
  expect((await iterator.next()).value).toMatchObject({ path: "/messages", value: [message("latest")] });
  const waiting = iterator.next();
  const patch = { op: "add" as const, path: "/messages/1", value: message("live") };
  conversation.push(patch);
  expect((await waiting).value).toEqual(patch);
  await iterator.return?.();
});

test("an approval makes progress when output continues during each delivery", async () => {
  const conversation = createSessionConversation(createEventStore(), [message("initial")]);
  const iterator = conversation.snapshotAndSubscribe().stream[Symbol.asyncIterator]();
  conversation.push({ op: "replace", path: "/messages/0", value: message("before") });
  conversation.push({ op: "replace", path: "/approval_request", value: { id: "approval" } });
  expect((await iterator.next()).value.path).toBe("/messages");
  conversation.push({ op: "replace", path: "/messages/0", value: message("during") });
  expect((await iterator.next()).value.path).toBe("/approval_request");
  expect((await iterator.next()).value).toMatchObject({ path: "/messages", value: [message("during")] });
  await iterator.return?.();
});

test("queued byte diagnostics count controls without discarded output between them", async () => {
  const events = createEventStore();
  const conversation = createSessionConversation(events, [message("initial")]);
  const iterator = conversation.snapshotAndSubscribe().stream[Symbol.asyncIterator]();
  const first = { op: "replace" as const, path: "/status", value: "running" };
  const last = { op: "replace" as const, path: "/status", value: "completed" };
  conversation.push(first);
  conversation.push({ op: "replace", path: "/messages/0", value: message("large", "x".repeat(10000)) });
  conversation.push(last);
  expect(events.diagnostics().queuedBytes).toBe(
    Buffer.byteLength(JSON.stringify(first)) + Buffer.byteLength(JSON.stringify(last)),
  );
  await iterator.return?.();
});
