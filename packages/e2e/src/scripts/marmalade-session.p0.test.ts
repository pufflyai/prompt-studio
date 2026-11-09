import { expect, test } from "bun:test";
import { marmaladeSessionFixture } from "./marmalade-session.test-fixture";

test("defocusing a property during view retirement completes its edit before closing the shared session", async () => {
  const fixture = marmaladeSessionFixture();
  const held = Promise.withResolvers<void>();
  try {
    const window = fixture.window("a");
    const frame = await window.frame();
    const peer = await window.frame();
    await frame.store.preview({ type: "text", id: "title", text: "Retained on defocus" }, "defocus");
    fixture.context("a").beforeNextCommit(() => held.promise);
    frame.stop();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(peer.store.getSnapshot().pendingCommands).toBe(1);
    held.resolve();
    await peer.store.retry();
    expect(peer.store.getSnapshot().state.document.layers.find((layer) => layer.id === "title")?.text).toBe(
      "Retained on defocus",
    );
    expect(peer.store.getSnapshot().state.history.undo).toBe(1);
  } finally {
    held.resolve();
    await fixture.dispose();
  }
});

test("a newer optional preview acknowledgement preserves an undelivered required command's optimism", async () => {
  const fixture = marmaladeSessionFixture();
  const held = Promise.withResolvers<void>();
  let delayed = false;
  let required = Promise.resolve();
  try {
    const frame = await fixture.window("a").frame(async (input) => {
      const request = input as { operation: string; params?: { action?: { type: string } } };
      if (!delayed && request.operation === "execute" && request.params?.action?.type === "text") {
        delayed = true;
        await held.promise;
      }
    });
    required = frame.store.dispatch({ type: "text", id: "title", text: "Required text" });
    await frame.store.preview({ type: "position", id: "title", x: 120 });
    expect(frame.store.getSnapshot().state.document.layers.find((layer) => layer.id === "title")?.text).toBe(
      "Required text",
    );
    held.resolve();
    await required;
    expect(frame.store.getSnapshot().state.document.layers.find((layer) => layer.id === "title")?.text).toBe(
      "Required text",
    );
  } finally {
    held.resolve();
    await required;
    await fixture.dispose();
  }
});

test("five real Marmalade stores share one authoritative load and presentation writes avoid document reads", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { value: new EventTarget(), configurable: true });
  const fixture = marmaladeSessionFixture();
  try {
    const window = fixture.window("a");
    const frames = await Promise.all(Array.from({ length: 5 }, () => window.frame()));
    expect(fixture.fullReads()).toBe(1);
    const before = fixture.fullReads();
    const storage = fixture.context("a");
    storage.reset();
    await frames[0].store.dispatch({ type: "tool", tool: "hand" });
    for (const frame of frames) expect(frame.store.getSnapshot().state.tool).toBe("hand");
    expect(fixture.fullReads()).toBe(before);
    expect(storage.commits).toHaveLength(1);
    expect(storage.reads.every((id) => id === storage.storage.records.id("marmalade:presentation"))).toBe(true);
  } finally {
    await fixture.dispose();
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("shared property previews cancel without history and complete as one undoable domain gesture", async () => {
  const fixture = marmaladeSessionFixture();
  try {
    const window = fixture.window("a");
    const [first, second] = await Promise.all([window.frame(), window.frame()]);
    const storage = fixture.context("a");
    storage.reset();
    const x = () => second.store.getSnapshot().state.document.layers.find((layer) => layer.id === "title")!.x;
    await first.store.preview({ type: "position", id: "title", x: 100 });
    await first.store.preview({ type: "position", id: "title", x: 120 });
    expect(x()).toBe(120);
    expect(second.store.getSnapshot().hasDrafts).toBe(true);
    expect(storage.commits).toHaveLength(0);
    await first.store.cancelPreview();
    expect(x()).toBe(85);
    expect(second.store.getSnapshot().state.history.undo).toBe(0);
    await first.store.preview({ type: "position", id: "title", x: 120 });
    await first.store.commitPreview();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(x()).toBe(120);
    expect(storage.commits).toHaveLength(1);
    expect(second.store.getSnapshot().state.history.undo).toBe(1);
    await second.store.dispatch({ type: "undo" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(x()).toBe(85);
    expect(first.store.getSnapshot().state.history).toEqual({ undo: 0, redo: 1 });
  } finally {
    await fixture.dispose();
  }
});

test("separate windows share drafts and accepted values while identical document IDs in other projects stay isolated", async () => {
  const fixture = marmaladeSessionFixture();
  try {
    const first = await fixture.window("a").frame();
    const peer = await fixture.window("a").frame();
    const other = await fixture.window("b").frame();
    expect(fixture.fullReads()).toBe(2);
    await first.store.preview({ type: "text", id: "title", text: "Shared preview" });
    expect(peer.store.getSnapshot().state.document.layers.find((layer) => layer.id === "title")?.text).toBe(
      "Shared preview",
    );
    expect(other.store.getSnapshot().state.document.layers.find((layer) => layer.id === "title")?.text).toBe(
      "The Great Wave",
    );
    const storage = fixture.context("a");
    const hold = Promise.withResolvers<void>();
    storage.beforeNextCommit(() => hold.promise);
    const committed = first.store.commitPreview();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(peer.store.getSnapshot().pendingCommands).toBe(1);
    hold.resolve();
    await committed;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(peer.store.getSnapshot().pendingCommands).toBe(0);
    first.stop();
    peer.stop();
    const before = fixture.fullReads();
    const restored = await fixture.window("a").frame();
    expect(fixture.fullReads()).toBe(before);
    expect(restored.store.getSnapshot().state.document.layers.find((layer) => layer.id === "title")?.text).toBe(
      "Shared preview",
    );
  } finally {
    await fixture.dispose();
  }
});

test("a failed gesture retains the shared draft and retries its operation exactly once", async () => {
  const fixture = marmaladeSessionFixture();
  try {
    const window = fixture.window("a");
    const [first, second] = await Promise.all([window.frame(), window.frame()]);
    const storage = fixture.context("a");
    storage.reset();
    storage.loseAcknowledgement();
    await first.store.preview({ type: "position", id: "title", x: 120 });
    await first.store.commitPreview();
    expect(first.store.getSnapshot().error).toBe("Acknowledgement lost");
    expect(second.store.getSnapshot().error).toBe("Acknowledgement lost");
    expect(second.store.getSnapshot().pendingCommands).toBe(1);
    await second.store.retry();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(first.store.getSnapshot().error).toBe("");
    expect(second.store.getSnapshot().state.document.layers.find((layer) => layer.id === "title")?.x).toBe(120);
    expect(second.store.getSnapshot().state.history.undo).toBe(1);
    expect(storage.commits).toHaveLength(1);
  } finally {
    await fixture.dispose();
  }
});

test("a property draft retains unrelated accepted edits from peers and other layers", async () => {
  const fixture = marmaladeSessionFixture();
  try {
    const window = fixture.window("a");
    const [first, second] = await Promise.all([window.frame(), window.frame()]);
    await first.store.preview({ type: "position", id: "title", x: 120 });
    await second.store.dispatch({ type: "text", id: "title", text: "Peer accepted" });
    await second.store.dispatch({ type: "text", id: "credit", text: "Other layer accepted" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    for (const { store } of [first, second]) {
      const state = store.getSnapshot().state;
      expect(state.document.layers.find((layer) => layer.id === "title")).toMatchObject({
        x: 120,
        text: "Peer accepted",
      });
      expect(state.document.layers.find((layer) => layer.id === "credit")?.text).toBe("Other layer accepted");
    }
  } finally {
    await fixture.dispose();
  }
});

test("returning a shared preview to its initial value clears the previous draft", async () => {
  const fixture = marmaladeSessionFixture();
  try {
    const window = fixture.window("a");
    const [first, second] = await Promise.all([window.frame(), window.frame()]);
    await first.store.preview({ type: "position", id: "title", x: 120 });
    await first.store.preview({ type: "position", id: "title", x: 85 });
    for (const { store } of [first, second]) {
      expect(store.getSnapshot().state.document.layers.find((layer) => layer.id === "title")?.x).toBe(85);
      expect(store.getSnapshot().hasDrafts).toBe(false);
    }
  } finally {
    await fixture.dispose();
  }
});

for (const completion of ["cancel", "commit"] as const) {
  test(`an older delayed preview cannot resurrect a ${completion === "cancel" ? "cancelled" : "completed"} gesture`, async () => {
    const fixture = marmaladeSessionFixture();
    const held = Promise.withResolvers<void>();
    try {
      const window = fixture.window("a");
      let delayed = false;
      const first = await window.frame(async (params) => {
        if (!delayed && (params as { operation: string }).operation === "preview") {
          delayed = true;
          await held.promise;
        }
      });
      const peer = await window.frame();
      const old = first.store.preview({ type: "position", id: "title", x: 120 });
      let latest = Promise.resolve();
      if (completion === "cancel") await first.store.cancelPreview();
      else {
        latest = first.store.preview({ type: "position", id: "title", x: 140 });
        await first.store.commitPreview();
      }
      expect(first.store.getSnapshot().state.document.layers.find((layer) => layer.id === "title")?.x).toBe(
        completion === "cancel" ? 85 : 140,
      );
      held.resolve();
      await Promise.all([old, latest]);
      for (const { store } of [first, peer]) {
        expect(store.getSnapshot().state.document.layers.find((layer) => layer.id === "title")?.x).toBe(
          completion === "cancel" ? 85 : 140,
        );
        expect(store.getSnapshot().hasDrafts).toBe(false);
      }
    } finally {
      held.resolve();
      await fixture.dispose();
    }
  });
}

test("a document refresh cannot cover a newer presentation event with its older composed snapshot", async () => {
  const fixture = marmaladeSessionFixture();
  try {
    const frame = await fixture.window("a").frame();
    const storage = fixture.context("a");
    const presentationId = storage.storage.records.id("marmalade:presentation");
    storage.afterNextRead(presentationId, async () => {
      await storage.source.records.commit({
        operationId: "concurrent-tool",
        edits: [{ recordId: presentationId, set: { "/values/tool": "hand" } }],
      });
      fixture.queries.invalidate({
        type: "reset",
        projectId: "a",
        extensionId: "pstdio.extension-lab",
        recordIds: [presentationId],
      });
    });
    fixture.queries.invalidate({
      type: "reset",
      projectId: "a",
      extensionId: "pstdio.extension-lab",
      recordIds: [storage.storage.records.id("marmalade:document:great-wave")],
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(frame.store.getSnapshot().state.tool).toBe("hand");
  } finally {
    await fixture.dispose();
  }
});

test("a late retry failure cannot repopulate a retired UI projection", async () => {
  const fixture = marmaladeSessionFixture();
  const held = Promise.withResolvers<void>();
  try {
    const frame = await fixture.window("a").frame(async (params) => {
      if ((params as { operation: string }).operation === "save") {
        await held.promise;
        throw new Error("Old project save failed");
      }
    });
    const retry = frame.store.retry();
    frame.stop();
    held.resolve();
    await retry;
    expect(frame.store.getSnapshot().error).toBe("");
    expect(frame.store.getSnapshot().ready).toBe(false);
  } finally {
    held.resolve();
    await fixture.dispose();
  }
});
