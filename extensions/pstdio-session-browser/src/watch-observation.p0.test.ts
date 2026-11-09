import { expect, test } from "bun:test";
import { saveNativeSubmission } from "./native-submission";
import { watchConversation } from "./watch";
import { createWatchObservationFixture } from "./watch-observation.test-fixture";

test("idle local sessions stay quiet; native command and workspace hints read only their own fields", async () => {
  const f = createWatchObservationFixture();
  const watching = watchConversation(f.ctx, { type: "session", id: "s" });
  try {
    await f.connected;
    await Bun.sleep(2100);
    expect(f.counts).toMatchObject({ execution: 1, session: 1, queue: 1, harness: 1, workspace: 1, stream: 1 });
    f.state.command = "/second";
    const updated = Promise.withResolvers<void>();
    f.state.wrote = (frame) => {
      if ("snapshot" in frame && frame.snapshot.harness?.commands.some((command) => command.name === "/second"))
        updated.resolve();
    };
    f.change("harness");
    f.change("harness");
    await updated.promise;
    expect(f.counts).toMatchObject({ execution: 1, session: 1, queue: 1, harness: 2, workspace: 1, stream: 1 });
    f.change("workspace");
    await Bun.sleep(0);
    expect(f.counts).toMatchObject({ execution: 1, session: 1, queue: 1, harness: 2, workspace: 2, stream: 1 });
  } finally {
    f.controller.abort();
    await watching;
  }
  expect(f.counts.closed).toBe(1);
});

test("a native input committed after the final session event still restores its accepted draft", async () => {
  const f = createWatchObservationFixture();
  f.session.status = "failed";
  f.session.lastRequestStarted = "2026-11-09T00:00:00Z";
  const recovered = Promise.withResolvers<unknown>();
  f.state.wrote = (frame) => {
    if ("recoverDraft" in frame) recovered.resolve(frame.recoverDraft);
  };
  const watching = watchConversation(f.ctx, { type: "session", id: "s" });
  try {
    await f.connected;
    const draft = { text: "Accepted objective", attachments: [], values: {} };
    await saveNativeSubmission(
      f.ctx,
      "s",
      { draft, operation: { kind: "command", text: "/goal objective" } },
      "previous",
      true,
    );
    expect(await recovered.promise).toEqual(draft);
    expect(f.counts).toMatchObject({ execution: 1, session: 1, queue: 1, harness: 1, stream: 1 });
  } finally {
    f.controller.abort();
    await watching;
  }
});

test("a later command hint cannot erase an interrupted session metadata refresh", async () => {
  const f = createWatchObservationFixture();
  const held = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const updated = Promise.withResolvers<void>();
  const watching = watchConversation(f.ctx, { type: "session", id: "s" });
  try {
    await f.connected;
    f.session.lastSelectedModel = "B";
    f.state.readExecution = async () => {
      held.resolve();
      await release.promise;
      return { kind: "local", available: true };
    };
    f.state.wrote = (frame) => {
      if ("snapshot" in frame && (frame.snapshot.values?.harness as { model?: string })?.model === "B")
        updated.resolve();
    };
    f.change("session");
    await held.promise;
    f.change("harness");
    release.resolve();
    await updated.promise;
    expect(f.counts.session).toBeGreaterThan(1);
  } finally {
    release.resolve();
    f.controller.abort();
    await watching;
  }
});

test("failed stream recovery reconnects without polling the session snapshot", async () => {
  const f = createWatchObservationFixture();
  const reconnected = Promise.withResolvers<void>();
  f.state.stream = async () => {
    if (f.counts.stream === 2) reconnected.resolve();
    throw new Error("Connection lost");
  };
  const watching = watchConversation(f.ctx, { type: "session", id: "s" });
  try {
    await reconnected.promise;
    expect(f.counts).toMatchObject({ execution: 1, session: 1, queue: 1, harness: 1, stream: 2 });
  } finally {
    f.controller.abort();
    await watching;
  }
});
