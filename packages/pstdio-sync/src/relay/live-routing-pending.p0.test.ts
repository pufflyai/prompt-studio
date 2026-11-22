import { expect, test } from "bun:test";
import type { LiveClientMessage } from "pstdio-sync-contracts";
import { documentConnectionFixture } from "./document-connection.test-fixture";
import { createLiveControls } from "./live-controls";

const until = async (condition: () => boolean) => {
  const deadline = Date.now() + 5000;
  while (!condition() && Date.now() < deadline) await Bun.sleep(1);
  expect(condition()).toBe(true);
};

test("live routing remains pending through held admission, queued follow and removal", async () => {
  const f = documentConnectionFixture({ heldTopic: "initial-document" });
  const release = f.live.subscribe({ spaceOwner: null, topic: "initial-document" });
  let unfollow = () => {};
  try {
    await f.held;
    expect(f.live.status()).toMatchObject({ connected: true, routingPending: true });
    unfollow = f.live.follow({ spaceOwner: null, topic: "preview_document_0123456789" }, () => {});
    f.admit();
    await until(() => f.live.status().routingPending === false);
    release();
    unfollow();
    expect(f.live.status().routingPending).toBe(true);
    await until(() => f.live.status().routingPending === false);
  } finally {
    release();
    unfollow();
    await f.close();
  }
});

test("routing observation covers retained replay, refusal and retry without sending work", async () => {
  const frames: LiveClientMessage[] = [];
  const retried = Promise.withResolvers<void>();
  let refused = 0;
  const controls = createLiveControls(
    (message) => {
      frames.push(message);
      if (frames.length === 5) retried.resolve();
      return true;
    },
    () => {
      refused++;
    },
    () => {},
  );
  const release = controls.retain(
    "document",
    { type: "subscribe", spaceOwner: null, topic: "initial_document_0123456789" },
    { type: "unsubscribe", spaceOwner: null, topic: "initial_document_0123456789" },
  );
  const acknowledge = (retryAfterMs: number | null) => {
    const frame = frames.at(-1);
    if (!frame || !("requestId" in frame) || !frame.requestId) throw new Error("Missing pending control");
    controls.result({ type: "control-result", requestId: frame.requestId, retryAfterMs });
  };
  expect(controls.pending()).toBe(true);
  expect(frames).toHaveLength(0);
  controls.ready();
  acknowledge(0);
  expect(controls.pending()).toBe(false);
  controls.reset();
  expect(controls.pending()).toBe(true);
  controls.ready();
  acknowledge(null);
  expect(refused).toBe(1);
  expect(controls.pending()).toBe(true);
  controls.ready();
  acknowledge(0);
  expect(controls.pending()).toBe(false);
  release();
  acknowledge(1);
  expect(controls.pending()).toBe(true);
  await retried.promise;
  expect(controls.pending()).toBe(true);
  acknowledge(0);
  expect(controls.pending()).toBe(false);
  expect(frames).toHaveLength(5);
});
