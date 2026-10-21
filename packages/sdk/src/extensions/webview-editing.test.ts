import { expect, test } from "bun:test";
import type { GuestHost } from "./guest-host";
import { createWebviewClient } from "./webview-client";

test("shared editing keeps newer local edits and ignores older host replies", async () => {
  let listener = (_value: unknown) => {};
  const replies: ((value: unknown) => void)[] = [];
  const host: GuestHost = {
    extensionId: "pstdio.lab",
    onEvent: (_scope, handler) => {
      listener = handler;
      return () => {
        listener = () => {};
      };
    },
    call: async <Result>(_method: string, input?: unknown) => {
      const request = input as { operation: string };
      if (request.operation === "commit")
        return (await new Promise<unknown>((resolve) => replies.push(resolve))) as Result;
      return { value: { title: "Original" }, version: 0, revision: 0, savedRevision: 0 } as Result;
    },
  };
  const session = await createWebviewClient(host).editing.open({
    key: "document",
    initial: { title: "Original" },
    save: { commandId: "pstdio.lab.command.save" },
  });
  const first = session.commit([{ path: ["title"], value: "A" }]);
  const second = session.commit([{ path: ["title"], value: "AB" }]);
  expect(session.getSnapshot().value.title).toBe("AB");
  const accept = (version: number, title: string, appliedSequence?: number) =>
    listener({
      sessionId: session.id,
      snapshot: { value: { title }, version, revision: version, savedRevision: 0 },
      appliedSequence,
    });
  accept(1, "A", 1);
  expect(session.getSnapshot().value.title).toBe("AB");
  accept(2, "AB", 2);
  accept(3, "Other view edit");
  replies[0]({ value: { title: "A" }, version: 1, revision: 1, savedRevision: 1 });
  replies[1]({ value: { title: "AB" }, version: 2, revision: 2, savedRevision: 2 });
  await Promise.all([first, second]);
  expect(session.getSnapshot().value.title).toBe("Other view edit");
  await session.close();
  accept(4, "After disposal");
  expect(session.getSnapshot().value.title).toBe("Other view edit");
});

test("overlapping backend refreshes retry a superseded read", async () => {
  let version = 0;
  let title = "Original";
  const snapshot = () => ({ value: { title }, version, revision: 0, savedRevision: 0 });
  const host: GuestHost = {
    extensionId: "pstdio.lab",
    onEvent: () => () => {},
    call: async <Result>(_method: string, input?: unknown) => {
      const request = input as { operation: string; expectedVersion?: number; value?: { title: string } };
      if (request.operation === "refresh") {
        if (request.expectedVersion !== version) return undefined as Result;
        title = request.value!.title;
        version++;
      }
      return snapshot() as Result;
    },
  };
  const session = await createWebviewClient(host).editing.open({
    key: "document",
    initial: { title },
    save: { commandId: "pstdio.lab.command.save" },
  });
  const reads: ((value: { title: string }) => void)[] = [];
  let started = () => {};
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  const read = () =>
    new Promise<{ title: string }>((resolve) => {
      reads.push(resolve);
      if (reads.length === 2) started();
      if (reads.length > 2) resolve({ title: "External edit 2" });
    });
  const first = session.refresh(read);
  const second = session.refresh(read);
  await reading;
  reads[0]({ title: "External edit 1" });
  await first;
  reads[1]({ title: "External edit 2" });
  await second;
  expect(reads).toHaveLength(3);
  expect(session.getSnapshot().value.title).toBe("External edit 2");
  await session.close();
});

test("pending local gestures cannot block an incoming structural edit", async () => {
  let listener = (_value: unknown) => {};
  let rejectPreview = (_error: Error) => {};
  const host: GuestHost = {
    extensionId: "pstdio.lab",
    onEvent: (_scope, handler) => {
      listener = handler;
      return () => {};
    },
    call: async <Result>(_method: string, input?: unknown) => {
      if ((input as { operation: string }).operation === "preview")
        return await new Promise<Result>((_resolve, reject) => {
          rejectPreview = reject;
        });
      return { value: { position: { x: 0 } }, version: 0, revision: 0, savedRevision: 0 } as Result;
    },
  };
  const session = await createWebviewClient(host).editing.open({
    key: "document",
    initial: { position: { x: 0 } },
    save: { commandId: "pstdio.lab.command.save" },
  });
  const preview = session.preview([{ path: ["position", "x"], value: 12 }]).catch((error: unknown) => error);
  expect(() =>
    listener({
      sessionId: session.id,
      snapshot: { value: { position: null }, version: 1, revision: 1, savedRevision: 0 },
    }),
  ).not.toThrow();
  expect(session.getSnapshot().value.position).toBeNull();
  rejectPreview(new Error("Editing paths must traverse objects"));
  await preview;
  expect(session.getSnapshot().value.position).toBeNull();
  await session.close();
});
