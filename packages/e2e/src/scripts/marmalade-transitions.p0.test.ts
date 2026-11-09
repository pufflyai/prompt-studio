import { expect, test } from "bun:test";
import { marmaladeSessionFixture } from "./marmalade-session.test-fixture";

test.each([2, 10])("%i retained projects keep five-view reopening warm and release inactive readers", async (count) => {
  const fixture = marmaladeSessionFixture();
  try {
    const windows = Array.from({ length: count }, (_, index) => fixture.window(`project-${index}`));
    for (const [index, window] of windows.entries()) {
      const frames = await Promise.all(Array.from({ length: 5 }, () => window.frame()));
      await frames[0]!.store.dispatch({ type: "tool", tool: index % 2 ? "brush" : "hand" });
      await frames[0]!.store.dispatch({ type: "viewport", zoom: 1 + index / 10, pan: { x: index + 1, y: -index - 1 } });
      for (const frame of frames) frame.stop();
      window.core.activation.setActive(false);
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(fixture.fullReads()).toBe(count);
    expect(fixture.queries.inspect().active).toBe(0);
    expect(fixture.queries.inspect().retained).toBeLessThanOrEqual(count * 2);
    const reads = [...windows.keys()].map((index) => fixture.context(`project-${index}`).reads.length);
    for (const [index, window] of windows.entries()) {
      window.core.activation.setActive(true);
      const frames = await Promise.all(Array.from({ length: 5 }, () => window.frame()));
      for (const frame of frames) {
        const snapshot = frame.store.getSnapshot();
        expect(snapshot.state.tool).toBe(index % 2 ? "brush" : "hand");
        expect(snapshot.state.zoom).toBe(1 + index / 10);
        expect(snapshot.state.pan).toEqual({ x: index + 1, y: -index - 1 });
        frame.stop();
      }
      window.core.activation.setActive(false);
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(fixture.fullReads()).toBe(count);
    expect([...windows.keys()].map((index) => fixture.context(`project-${index}`).reads.length)).toEqual(reads);
    expect(fixture.queries.inspect().active).toBe(0);
    fixture.queries.clearScope({ projectId: "project-0" });
    expect(fixture.queries.inspect().retained).toBeLessThanOrEqual((count - 1) * 2);
  } finally {
    await fixture.dispose();
  }
});

test("evicted Marmalade projects reload once while the retained project stays warm", async () => {
  const fixture = marmaladeSessionFixture({ maxInactive: 3 });
  try {
    const windows = ["a", "b", "c"].map((id) => fixture.window(id));
    for (const window of windows) {
      const frame = await window.frame();
      frame.stop();
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(fixture.fullReads()).toBe(3);
    expect(fixture.queries.inspect().retained).toBeLessThanOrEqual(3);
    const retained = await windows[2]!.frame();
    expect(fixture.fullReads()).toBe(3);
    retained.stop();
    const evicted = await windows[0]!.frame();
    expect(fixture.fullReads()).toBe(4);
    evicted.stop();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(fixture.queries.inspect().active).toBe(0);
    expect(fixture.queries.inspect().retained).toBeLessThanOrEqual(3);
  } finally {
    await fixture.dispose();
  }
});

test("failed warm catch-up retains accepted presentation and exposes an explicit retry after a prior mutation", async () => {
  const fixture = marmaladeSessionFixture();
  try {
    const window = fixture.window("a");
    const first = await window.frame();
    await first.store.dispatch({ type: "tool", tool: "hand" });
    first.stop();
    await new Promise<void>((resolve) => setImmediate(resolve));
    await window.core.commands.executeCommand("pstdio.extension-lab.command.marmalade.session.execute", {
      action: { type: "tool", tool: "brush" },
    });
    const storage = fixture.context("a");
    storage.afterNextRead(storage.storage.records.id("marmalade:presentation"), async () => {
      throw new Error("Refresh failed");
    });
    const frame = await window.frame();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(frame.store.getSnapshot().ready).toBe(true);
    expect(frame.store.getSnapshot().state.tool).toBe("hand");
    expect(frame.store.getSnapshot().error).toContain("Refresh failed");
    expect(fixture.commandReads.get("marmalade.presentation.read")).toBe(1);
    await frame.store.retry();
    expect(frame.store.getSnapshot().state.tool).toBe("brush");
    expect(frame.store.getSnapshot().error).toBe("");
    expect(fixture.commandReads.get("marmalade.presentation.read")).toBe(2);
    expect(fixture.fullReads()).toBe(1);
  } finally {
    await fixture.dispose();
  }
});

test("a warm project restores accepted content before its scoped presentation catch-up finishes", async () => {
  const fixture = marmaladeSessionFixture();
  const held = Promise.withResolvers<void>();
  let opening: ReturnType<ReturnType<typeof fixture.window>["frame"]> | undefined;
  try {
    const window = fixture.window("a");
    const first = await window.frame();
    await first.store.dispatch({ type: "tool", tool: "hand" });
    first.stop();
    const reads = fixture.fullReads();
    await window.core.commands.executeCommand("pstdio.extension-lab.command.marmalade.session.execute", {
      action: { type: "tool", tool: "brush" },
    });
    const started = Promise.withResolvers<void>();
    const storage = fixture.context("a");
    storage.afterNextRead(storage.storage.records.id("marmalade:presentation"), async () => {
      started.resolve();
      await held.promise;
    });
    let restored: Awaited<NonNullable<typeof opening>> | undefined;
    opening = window.frame().then((frame) => {
      restored = frame;
      return frame;
    });
    await started.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(restored).toBeDefined();
    const frame = await opening;
    expect(frame.store.getSnapshot().state.tool).toBe("hand");
    const caughtUp = Promise.withResolvers<void>();
    const stop = frame.store.subscribe(() => {
      if (frame.store.getSnapshot().state.tool === "brush") caughtUp.resolve();
    });
    held.resolve();
    await caughtUp.promise;
    stop();
    expect(fixture.fullReads()).toBe(reads);
  } finally {
    held.resolve();
    await opening;
    await fixture.dispose();
  }
});
