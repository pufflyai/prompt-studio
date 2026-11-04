import { expect, test } from "bun:test";
import type { TextEditingEvent } from "pstdio-api-contracts/extension-kernel";
import type { SessionEventSink } from "../sessions/session-stream-connections";
import { streamTextEditingEvents } from "./shared-stream";

const fixture = (write: SessionEventSink["write"]) => {
  let emit: (event: TextEditingEvent) => void = () => {};
  let stops = 0;
  let aborted = false;
  const abortListeners = new Set<() => void>();
  const service = {
    listen(_input: unknown, listener: typeof emit) {
      emit = listener;
      return () => {
        stops++;
      };
    },
  } as Parameters<typeof streamTextEditingEvents>[0];
  const sink: SessionEventSink = {
    get aborted() {
      return aborted;
    },
    onAbort: (listener) => {
      abortListeners.add(listener);
    },
    sleep: Bun.sleep,
    write,
  };
  const work = streamTextEditingEvents(service, { project_id: "project", token: "token" }, sink);
  return {
    work,
    emit: (event: TextEditingEvent) => emit(event),
    stops: () => stops,
    abort() {
      aborted = true;
      for (const listener of abortListeners) listener();
    },
  };
};

test("cancelling a text watch detaches and settles while its shared socket ready write is blocked", async () => {
  const blocked = Promise.withResolvers<void>();
  const f = fixture(() => blocked.promise);
  let settled = false;
  void f.work.then(() => {
    settled = true;
  });
  try {
    f.abort();
    expect(f.stops()).toBe(1);
    await Bun.sleep(0);
    expect(settled).toBe(true);
  } finally {
    blocked.resolve();
    f.abort();
    await f.work;
  }
});

test("a slow text watcher receives the latest queued member state instead of every superseded presence frame", async () => {
  const blocked = Promise.withResolvers<void>();
  const first = Promise.withResolvers<void>();
  const last = Promise.withResolvers<void>();
  const versions: number[] = [];
  const f = fixture(async (event, value) => {
    if (event !== "text") return;
    const frame = value as Extract<TextEditingEvent, { type: "presence" }>;
    versions.push(frame.version);
    if (frame.version === 1) {
      first.resolve();
      await blocked.promise;
    }
    if (frame.version === 10_000) last.resolve();
  });
  try {
    f.emit({ type: "presence", memberId: "member", handle: "handle", version: 1, participants: [] });
    await first.promise;
    for (let version = 2; version <= 10_000; version++)
      f.emit({ type: "presence", memberId: "member", handle: "handle", version, participants: [] });
    blocked.resolve();
    await last.promise;
    expect(versions.length).toBe(2);
    expect(versions.at(-1)).toBe(10_000);
  } finally {
    blocked.resolve();
    f.abort();
    await f.work;
  }
});

test("a queued event overflow stops this watch and reports a retryable reset without awaiting its socket", async () => {
  const blocked = Promise.withResolvers<void>();
  const errors: unknown[] = [];
  const f = fixture((event, data) => {
    if (event === "text_error") {
      errors.push(data);
      return Promise.resolve();
    }
    return blocked.promise;
  });
  try {
    for (let index = 0; index < 1000; index++)
      f.emit({ type: "presence", memberId: String(index), handle: String(index), version: 1, participants: [] });
    await f.work;
    expect(f.stops()).toBe(1);
    expect(errors).toMatchObject([{ code: "connection_reset", retryable: true }]);
  } finally {
    blocked.resolve();
    f.abort();
    await f.work;
  }
});

test("one previously supported oversized snapshot can travel without a new document-size limit", async () => {
  const ready = Promise.withResolvers<void>();
  const delivered = Promise.withResolvers<void>();
  const state = "X".repeat(9 * 1024 * 1024);
  const f = fixture(async (event, value) => {
    if (event === "text_ready") await ready.promise;
    if (event === "text") {
      expect((value as Extract<TextEditingEvent, { type: "snapshot" }>).snapshot.state.length).toBe(state.length);
      delivered.resolve();
    }
  });
  try {
    f.emit({
      type: "snapshot",
      memberId: "member",
      handle: "handle",
      version: 1,
      snapshot: { state, seedId: "seed", sourceSeedId: "source", revision: 1, editable: true },
    });
    expect(f.stops()).toBe(0);
    ready.resolve();
    await delivered.promise;
  } finally {
    ready.resolve();
    f.abort();
    await f.work;
  }
});

test("coalescing full states keeps their cross-type member version order", async () => {
  const first = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const last = Promise.withResolvers<void>();
  const versions: number[] = [];
  const f = fixture(async (event, data) => {
    if (event !== "text") return;
    const frame = data as Extract<TextEditingEvent, { type: "presence" | "snapshot" }>;
    versions.push(frame.version);
    if (frame.version === 1) {
      first.resolve();
      await release.promise;
    }
    if (frame.version === 4) last.resolve();
  });
  try {
    f.emit({ type: "presence", memberId: "member", handle: "handle", version: 1, participants: [] });
    await first.promise;
    f.emit({ type: "presence", memberId: "member", handle: "handle", version: 2, participants: [] });
    f.emit({
      type: "snapshot",
      memberId: "member",
      handle: "handle",
      version: 3,
      snapshot: { state: "", seedId: "seed", sourceSeedId: "source", revision: 1, editable: true },
    });
    f.emit({ type: "presence", memberId: "member", handle: "handle", version: 4, participants: [] });
    release.resolve();
    await last.promise;
    expect(versions).toEqual([1, 3, 4]);
  } finally {
    release.resolve();
    f.abort();
    await f.work;
  }
});
