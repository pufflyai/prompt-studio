import { expect, test } from "bun:test";
import type { CommandContext } from "@pstdio/sdk/extensions";
import { watchConversation } from "./watch";
import { createWatchObservationFixture } from "./watch-observation.test-fixture";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const queue = { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null };
type QueueResult = Awaited<ReturnType<CommandContext["sessions"]["getQueuedMessages"]>>;
type OnEvent = Parameters<CommandContext["sessions"]["stream"]>[1];

const remoteFixture = () => {
  const f = createWatchObservationFixture();
  f.state.readExecution = async () => ({ kind: "remote", available: true, device: { id: "owner", name: "Laptop" } });
  let emit!: OnEvent;
  f.state.stream = async (onEvent, signal) => {
    emit = onEvent;
    await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
  };
  return { ...f, emit: (event: Parameters<OnEvent>[0]) => emit(event) };
};

test("an execution availability hint refreshes a read-only remote queue without rereading unrelated metadata", async () => {
  const f = createWatchObservationFixture();
  let available = false;
  f.state.readExecution = async () => ({ kind: "remote", available, device: { id: "owner", name: "Laptop" } });
  f.state.readQueue = async () => ({ messages: [], queue: { ...queue, readOnly: !available } });
  const watching = watchConversation(f.ctx, { type: "session", id: "s" });
  try {
    await f.connected;
    available = true;
    f.change("execution");
    await turn();
    expect(f.counts).toMatchObject({ execution: 2, session: 1, queue: 2, harness: 0, stream: 1 });
    expect(f.frames.at(-1)).toMatchObject({ snapshot: { readOnly: false, queueReadOnly: false } });
  } finally {
    f.controller.abort();
    await watching;
  }
});

test("a failed stream queue remains read-only through transcript patches until an editable queue arrives", async () => {
  const f = remoteFixture();
  const watching = watchConversation(f.ctx, { type: "session", id: "s" });
  try {
    await f.connected;
    await f.emit({ event: "queued_messages", data: { error: "Queue unavailable" } });
    await f.emit({ event: "patch", data: { op: "replace", path: "/messages", value: [] } });
    expect(f.frames.at(-1)).toMatchObject({ snapshot: { queueReadOnly: true } });
    await f.emit({ event: "queued_messages", data: { messages: [], queue } });
    expect(f.frames.at(-1)).toMatchObject({ snapshot: { queueReadOnly: false, notice: "" } });
    await Bun.sleep(2100);
    expect(f.counts.queue).toBe(1);
  } finally {
    f.controller.abort();
    await watching;
  }
});

test("a healthy streamed queue fences an older failed recovery and the cached inputs of later hints", async () => {
  const f = remoteFixture();
  const entered = Promise.withResolvers<void>();
  const held = Promise.withResolvers<QueueResult>();
  f.state.readQueue = async () => {
    if (f.counts.queue === 1) return { messages: [], queue: { ...queue, readOnly: true } };
    entered.resolve();
    return held.promise;
  };
  const watching = watchConversation(f.ctx, { type: "session", id: "s" });
  try {
    await f.connected;
    await entered.promise;
    await f.emit({ event: "queued_messages", data: { messages: [], queue } });
    held.reject(new Error("Stale queue failure"));
    await turn();
    f.change("workspace");
    await turn();
    expect(f.frames.slice(1)).not.toContainEqual(
      expect.objectContaining({ snapshot: expect.objectContaining({ notice: "Stale queue failure" }) }),
    );
    expect(f.frames.at(-1)).toMatchObject({ snapshot: { notice: "" } });
    await Bun.sleep(2100);
    expect(f.counts).toMatchObject({ execution: 1, session: 1, queue: 2, stream: 1 });
  } finally {
    f.controller.abort();
    await watching;
  }
});

test("going offline or closing the last observer cancels pending queue recovery", async () => {
  const offline = remoteFixture();
  const closed = remoteFixture();
  for (const f of [offline, closed])
    f.state.readQueue = async () => ({ messages: [], queue: { ...queue, readOnly: true } });
  let online = true;
  offline.state.readExecution = async () => ({
    kind: "remote",
    available: online,
    device: { id: "owner", name: "Laptop" },
  });
  const watchingOffline = watchConversation(offline.ctx, { type: "session", id: "s" });
  const watchingClosed = watchConversation(closed.ctx, { type: "session", id: "s" });
  try {
    await Promise.all([offline.connected, closed.connected]);
    online = false;
    offline.change("execution");
    await turn();
    closed.controller.abort();
    await watchingClosed;
    await Bun.sleep(2100);
    expect(offline.counts).toMatchObject({ execution: 2, session: 1, queue: 2, stream: 1 });
    expect(closed.counts).toMatchObject({ queue: 1, closed: 1 });
  } finally {
    offline.controller.abort();
    closed.controller.abort();
    await Promise.all([watchingOffline, watchingClosed]);
  }
});

test("only an observed read-only online remote queue recovers and becomes quiet after accepting its owner", async () => {
  const f = createWatchObservationFixture();
  f.state.readExecution = async () => ({ kind: "remote", available: true, device: { id: "owner", name: "Laptop" } });
  f.state.readQueue = async () => ({ messages: [], queue: { ...queue, readOnly: f.counts.queue === 1 } });
  const watching = watchConversation(f.ctx, { type: "session", id: "s" });
  try {
    await f.connected;
    await Bun.sleep(2100);
    expect(f.counts).toMatchObject({ execution: 1, session: 1, queue: 2, harness: 0, native: 2, stream: 1 });
    expect(f.frames.at(-1)).toMatchObject({ snapshot: { queueReadOnly: false } });
    await Bun.sleep(2100);
    expect(f.counts.queue).toBe(2);
  } finally {
    f.controller.abort();
    await watching;
  }
});
