import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "../deps";
import type { SessionEventSink } from "../session-stream-connections";
import { streamPersonalSession } from "./stream-personal-session";

test("a live preview arriving before earlier completed messages is shown as soon as the gap closes", async () => {
  type Update = { index: number; message: SessionMessage; live: boolean };
  let listener: ((update: Update) => void) | undefined;
  const snapshot = Promise.withResolvers<void>();
  const previewShown = Promise.withResolvers<void>();
  const writes: unknown[] = [];
  const message = (id: string): SessionMessage => ({ id, role: "assistant", parts: [{ type: "text", text: id }] });
  const deps = {
    sessionService: { get: async () => null },
    personalHistoryService: {
      getSession: async () => ({ id: "session", project_id: "project", status: "in_progress" }),
      messages: async () => [],
      watchMessages: (_id: string, callback: (update: Update) => void) => {
        listener = callback;
        return () => {
          listener = undefined;
        };
      },
    },
  } as unknown as SessionsRouteDeps;
  const controller = new AbortController();
  const sink: SessionEventSink = {
    get aborted() {
      return controller.signal.aborted;
    },
    onAbort() {},
    sleep: () => new Promise<void>(() => {}),
    async write(event, data) {
      const patch = data as { path?: string; value?: unknown };
      writes.push({ event, data });
      if (patch.path === "/messages") snapshot.resolve();
      if (patch.path === "/messages/1") {
        previewShown.resolve();
        controller.abort();
      }
    },
  };
  const running = streamPersonalSession("session", deps, sink);
  try {
    await snapshot.promise;
    listener!({ index: 1, message: message("streaming"), live: true });
    listener!({ index: 0, message: message("completed"), live: false });
    expect(await Promise.race([previewShown.promise.then(() => true), Bun.sleep(500).then(() => false)])).toBe(true);
    expect(writes).toContainEqual({
      event: "patch",
      data: { op: "add", path: "/messages/1", value: message("streaming") },
    });
  } finally {
    controller.abort();
    listener?.({ index: 0, message: message("completed"), live: false });
    await running;
  }
});

test.each([
  true,
  false,
])("a newer message supersedes a pending preview during a slow earlier write (live: %s)", async (live) => {
  type Update = { index: number; message: SessionMessage; live: boolean };
  let listener: ((update: Update) => void) | undefined;
  const snapshot = Promise.withResolvers<void>();
  const blocked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const row = { id: "session", project_id: "project", status: "in_progress" };
  const message = (id: string): SessionMessage => ({ id, role: "assistant", parts: [{ type: "text", text: id }] });
  const finalWrites: unknown[] = [];
  const deps = {
    sessionService: { get: async () => null },
    personalHistoryService: {
      getSession: async () => row,
      messages: async () => [],
      watchMessages: (_id: string, callback: (update: Update) => void) => {
        listener = callback;
        return () => {
          listener = undefined;
        };
      },
    },
  } as unknown as SessionsRouteDeps;
  const controller = new AbortController();
  const sink: SessionEventSink = {
    get aborted() {
      return controller.signal.aborted;
    },
    onAbort() {},
    sleep: () => new Promise<void>(() => {}),
    async write(_event, data) {
      const patch = data as { path?: string; value?: unknown };
      if (patch.path === "/messages") snapshot.resolve();
      if (patch.path === "/messages/0") {
        blocked.resolve();
        await release.promise;
      }
      if (patch.path === "/messages/1") finalWrites.push(patch.value);
    },
  };
  const running = streamPersonalSession("session", deps, sink);
  try {
    await snapshot.promise;
    listener!({ index: 1, message: message("older-preview"), live: true });
    listener!({ index: 0, message: message("earlier-completed"), live: false });
    await blocked.promise;
    listener!({ index: 1, message: message("newer-message"), live });
    row.status = "completed";
    release.resolve();
    await running;
    expect(finalWrites.at(-1)).toEqual(message("newer-message"));
  } finally {
    controller.abort();
    release.resolve();
    listener?.({ index: 0, message: message("earlier-completed"), live: false });
    await running;
  }
});
