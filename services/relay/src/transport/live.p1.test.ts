import { afterEach, expect, test } from "bun:test";
import type { LiveServerMessage } from "pstdio-sync-contracts";
import { defaultRelayLimits } from "../limits";
import { createLiveHub } from "./live";

const topic = "opaque_topic_123456";
const payload = Buffer.from("opaque ciphertext").toString("base64");
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});
const fixture = (limits = defaultRelayLimits) => {
  const hub = createLiveHub(limits, () => true);
  const connect = (deviceId: string, accountId = "owner", projectKey = "project") => {
    const messages: LiveServerMessage[] = [];
    const codes: number[] = [];
    const socket = hub.connect({
      projectKey,
      accountId,
      deviceId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    socket.open({
      send: (data) => {
        messages.push(JSON.parse(String(data)));
        return 1;
      },
      close: (code) => {
        codes.push(code!);
      },
    });
    cleanup.push(socket.close);
    messages.length = 0;
    return {
      messages,
      codes,
      close: socket.close,
      send: (message: unknown) => socket.message(JSON.stringify(message)),
    };
  };
  return { hub, connect };
};

test("publishes reach only current topic subscribers in the project and space", () => {
  const f = fixture();
  const sender = f.connect("sender");
  const reader = f.connect("reader");
  const idle = f.connect("idle");
  const otherProject = f.connect("other", "owner", "elsewhere");
  reader.send({ type: "subscribe", spaceOwner: null, topic });
  otherProject.send({ type: "subscribe", spaceOwner: null, topic });
  sender.send({ type: "publish", spaceOwner: null, topic, payload });
  expect(reader.messages).toEqual([{ type: "event", spaceOwner: null, topic, deviceId: "sender", payload }]);
  expect(idle.messages).toEqual([]);
  expect(sender.messages).toEqual([]);
  expect(otherProject.messages).toEqual([]);
  reader.send({ type: "unsubscribe", spaceOwner: null, topic });
  sender.send({ type: "publish", spaceOwner: null, topic, payload });
  expect(reader.messages).toHaveLength(1);
});

test("subscriber followers get the current state and first/last remote reader transitions immediately", () => {
  const f = fixture();
  const sender = f.connect("sender");
  const a = f.connect("a");
  const b = f.connect("b");
  sender.send({ type: "follow", spaceOwner: null, topic });
  expect(sender.messages.pop()).toMatchObject({ type: "subscribers", active: false });
  sender.send({ type: "subscribe", spaceOwner: null, topic });
  expect(sender.messages).toEqual([]);
  a.send({ type: "subscribe", spaceOwner: null, topic });
  expect(sender.messages.pop()).toMatchObject({ type: "subscribers", active: true });
  b.send({ type: "subscribe", spaceOwner: null, topic });
  a.close();
  expect(sender.messages).toEqual([]);
  b.close();
  expect(sender.messages.pop()).toMatchObject({ type: "subscribers", active: false });
});

test("private subscriptions cannot read another owner, even using the same opaque topic", () => {
  const f = fixture();
  const sender = f.connect("sender");
  const reader = f.connect("reader");
  const stranger = f.connect("stranger", "stranger");
  reader.send({ type: "subscribe", spaceOwner: "owner", topic });
  stranger.send({ type: "subscribe", spaceOwner: "owner", topic });
  expect(stranger.codes).toEqual([1008]);
  sender.send({ type: "publish", spaceOwner: "owner", topic, payload });
  expect(reader.messages).toHaveLength(1);
  expect(stranger.messages).toEqual([]);
});

test("document notices wake its subscribers; discovery sees only the first committed content", () => {
  const f = fixture();
  const reader = f.connect("reader");
  const discovery = f.connect("discovery");
  const idle = f.connect("idle");
  reader.send({ type: "subscribe", spaceOwner: null, topic });
  discovery.send({ type: "discover", spaceOwner: null });
  f.hub.changed({
    projectKey: "project",
    spaceOwner: null,
    documentId: topic,
    lastSequence: 1,
    stateId: null,
    created: true,
  });
  expect(reader.messages).toHaveLength(1);
  expect(discovery.messages).toHaveLength(1);
  f.hub.changed({ projectKey: "project", spaceOwner: null, documentId: topic, lastSequence: 2, stateId: null });
  expect(reader.messages).toHaveLength(2);
  expect(discovery.messages).toHaveLength(1);
  expect(idle.messages).toEqual([]);
});

test("calls fail immediately offline or unregistered and route partial results, cancellation and disconnect", () => {
  const f = fixture();
  const a = f.connect("a");
  const b = f.connect("b");
  const call = (id: string) =>
    a.send({ type: "call", id, deviceId: "b", procedure: topic, spaceOwner: "owner", payload });
  call("unregistered");
  expect(a.messages.pop()).toMatchObject({ type: "call-error", id: "unregistered", error: "unavailable" });
  b.send({ type: "register", procedure: topic, spaceOwner: "owner" });
  call("one");
  const invocation = b.messages.pop();
  expect(invocation).toMatchObject({ type: "invocation", deviceId: "a", procedure: topic, payload });
  if (invocation?.type !== "invocation") throw new Error("Missing invocation");
  b.send({ type: "result", id: invocation.id, payload, done: false });
  expect(a.messages.pop()).toMatchObject({ type: "result", id: "one", done: false });
  a.send({ type: "cancel", id: "one" });
  expect(b.messages.pop()).toEqual({ type: "cancelled", id: invocation.id });
  expect(a.messages.pop()).toMatchObject({ type: "call-error", id: "one", error: "cancelled" });
  call("two");
  b.close();
  expect(a.messages.pop()).toMatchObject({ type: "call-error", id: "two", error: "disconnected" });
  call("offline");
  expect(a.messages.pop()).toMatchObject({ type: "call-error", id: "offline", error: "unavailable" });
});

test("routing state and message bytes are bounded", () => {
  const f = fixture({ ...defaultRelayLimits, maxLiveSubscriptions: 1 });
  const a = f.connect("a");
  a.send({ type: "subscribe", spaceOwner: null, topic });
  a.send({ type: "subscribe", spaceOwner: null, topic: "another_topic_123456" });
  expect(a.codes).toEqual([1013]);
  const b = f.connect("b");
  b.send({
    type: "publish",
    spaceOwner: null,
    topic,
    payload: Buffer.alloc(defaultRelayLimits.maxLiveMessageBytes + 1).toString("base64"),
  });
  expect(b.codes).toEqual([1009]);
});

test("concurrent callers can reuse IDs and only their selected callee can answer", () => {
  const f = fixture();
  const a = f.connect("a");
  const b = f.connect("b");
  const callee = f.connect("callee");
  const stranger = f.connect("stranger");
  callee.send({ type: "register", spaceOwner: null, procedure: topic });
  for (const caller of [a, b])
    caller.send({ type: "call", id: "same", deviceId: "callee", procedure: topic, spaceOwner: null, payload });
  const [one, two] = callee.messages;
  if (one?.type !== "invocation" || two?.type !== "invocation") throw new Error("Missing invocations");
  expect(one.id).not.toBe(two.id);
  stranger.send({ type: "result", id: one.id, payload, done: true });
  expect(stranger.codes).toEqual([1008]);
  expect(a.messages).toEqual([]);
  callee.send({ type: "result", id: two.id, payload, done: true });
  expect(b.messages.pop()).toEqual({ type: "result", id: "same", deviceId: "callee", payload, done: true });
  a.close();
  expect(callee.messages.at(-1)).toEqual({ type: "cancelled", id: one.id });
  callee.send({ type: "result", id: one.id, payload, done: true });
  expect(a.messages).toEqual([]);
});

test("active calls are bounded on the caller and callee and completion frees capacity", () => {
  const f = fixture({ ...defaultRelayLimits, maxLiveCalls: 1 });
  const a = f.connect("a");
  const b = f.connect("b");
  b.send({ type: "register", spaceOwner: null, procedure: topic });
  const call = (id: string) => a.send({ type: "call", id, deviceId: "b", procedure: topic, spaceOwner: null, payload });
  call("one");
  call("two");
  expect(a.messages.pop()).toEqual({ type: "call-error", id: "two", error: "limit-exceeded" });
  const invocation = b.messages.pop();
  if (invocation?.type !== "invocation") throw new Error("Missing invocation");
  b.send({ type: "result", id: invocation.id, payload, done: true });
  call("three");
  expect(b.messages.at(-1)).toMatchObject({ type: "invocation" });
});
