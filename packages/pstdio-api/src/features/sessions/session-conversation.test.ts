import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createSessionConversation } from "./session-conversation";

const message = (id: string, text = id): SessionMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text }],
});

test("conversation retains the complete history after delivery log eviction", () => {
  const events = createEventStore({ maxSizeBytes: 1 });
  const conversation = createSessionConversation(events, [message("baseline")]);
  conversation.push({ op: "add", path: "/messages/1", value: message("next") });
  expect(events.getHistory()).toEqual([]);
  expect(conversation.getMessages()).toEqual([message("baseline"), message("next")]);
});

test("a provider history conflict remains visible after delivery log eviction", () => {
  const conversation = createSessionConversation(createEventStore({ maxSizeBytes: 1 }), [message("saved")]);
  const historyIssue = { code: "reconciliation_conflict" as const, category: "ambiguous_metadata_owner" };
  conversation.push({ op: "replace", path: "/history_issue", value: historyIssue });
  expect(conversation.historyIssue).toEqual(historyIssue);
  expect(conversation.snapshotAndSubscribe().historyIssue).toEqual(historyIssue);
  expect(conversation.getMessages()).toEqual([message("saved")]);
  conversation.close();
});

test("snapshot and subscription share an exact patch boundary", async () => {
  const conversation = createSessionConversation(createEventStore(), [message("initial")]);
  const snapshot = conversation.snapshotAndSubscribe();
  const patch = { op: "replace" as const, path: "/messages/0", value: message("updated") };
  conversation.push(patch);
  expect(snapshot.messages).toEqual([message("initial")]);
  const iterator = snapshot.stream[Symbol.asyncIterator]();
  expect(await iterator.next()).toEqual({ done: false, value: patch });
  await iterator.return?.();
});

test("empty raw messages keep their coordinates and root replacement can clear history", () => {
  const conversation = createSessionConversation(createEventStore());
  conversation.push({ op: "add", path: "/messages/0", value: message("empty", "") });
  conversation.push({ op: "add", path: "/messages/1", value: message("next") });
  conversation.push({ op: "replace", path: "/messages/0", value: message("filled") });
  expect(conversation.getMessages()).toEqual([message("filled"), message("next")]);
  expect(() => conversation.push({ op: "replace", path: "/messages/3", value: message("hole") })).toThrow();
  conversation.push({ op: "replace", path: "/messages", value: [] });
  expect(conversation.getMessages()).toEqual([]);
});

test("closed conversations remain readable and late subscribers end immediately", async () => {
  const conversation = createSessionConversation(createEventStore(), [message("saved")]);
  conversation.close();
  conversation.close();
  const snapshot = conversation.snapshotAndSubscribe();
  expect(snapshot.messages).toEqual([message("saved")]);
  expect(await snapshot.stream[Symbol.asyncIterator]().next()).toEqual({ done: true, value: undefined });
  expect(() => conversation.push({ op: "replace", path: "/messages", value: [] })).toThrow();
});
