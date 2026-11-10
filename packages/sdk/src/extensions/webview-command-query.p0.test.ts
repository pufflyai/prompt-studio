import { expect, test } from "bun:test";
import { defineCommand } from "./define-command";
import type { GuestHost } from "./guest-host";
import { createWebviewClient } from "./webview-client";

test("a command query restores its host-retained value before observing a recreated frame", () => {
  const host = {
    extensionId: "example.tool",
    propsStore: {
      get: () => ({
        projectId: "project-a",
        queryScope: { runtimeId: "runtime", accountId: "account" },
        commandQueries: {
          owner: "trusted-source-a",
          values: [
            {
              command: { commandId: "example.tool.command.read" },
              snapshot: { generation: 1, version: 1, data: { title: "Retained A" }, stale: false, fetching: false },
            },
          ],
        },
      }),
      subscribe: () => () => {},
    },
    onEvent: () => () => {},
    call: async () => {
      throw new Error("Restoring a snapshot must not execute a command");
    },
  } as unknown as GuestHost;
  const definitions = { read: defineCommand({ id: "read", title: "Read", run: () => ({ title: "Retained A" }) }) };
  const client = createWebviewClient<typeof definitions>(host);
  const command = client.commands.read;
  const query = command.query();
  expect(query.getSnapshot().data).toEqual({ title: "Retained A" });
  client.queries.dispose();
});

const bridge = () => {
  const calls: Array<{ input: Record<string, unknown>; reply: ReturnType<typeof Promise.withResolvers<unknown>> }> = [];
  const listeners = new Set<(event: unknown) => void>();
  const propsListeners = new Set<(props: never) => void>();
  const props = {
    projectId: "project-a",
    commandQueries: { owner: "owner", values: [] },
  };
  const host = {
    extensionId: "example.tool",
    propsStore: {
      get: () => props,
      subscribe(listener: (props: never) => void) {
        propsListeners.add(listener);
        return () => propsListeners.delete(listener);
      },
    },
    onEvent(_scope: string, listener: (event: unknown) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    call(_method: string, input: Record<string, unknown>) {
      const reply = Promise.withResolvers<unknown>();
      calls.push({ input, reply });
      if (input.operation === "close") reply.resolve(undefined);
      return reply.promise;
    },
  } as unknown as GuestHost;
  const definitions = { read: defineCommand({ id: "read", title: "Read", run: () => ({ title: "" }) }) };
  const client = createWebviewClient<typeof definitions>(host);
  const query = client.commands.read.query();
  const snapshot = (version: number, title: string, generation = 1) => ({
    version,
    generation,
    data: { title },
    stale: false,
    fetching: false,
  });
  return {
    host,
    client,
    query,
    calls,
    snapshot,
    emit(requestId: unknown, value: ReturnType<typeof snapshot>) {
      for (const listener of [...listeners]) listener({ requestId, snapshot: value });
    },
    rotate() {
      props.commandQueries.owner = "another-authority";
      for (const listener of [...propsListeners]) listener(props as never);
    },
  };
};
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("a newer publication wins over the initial response and a delayed older finite read", async () => {
  const f = bridge();
  const stop = f.query.subscribe(() => {});
  const opening = f.calls[0]!;
  f.emit(opening.input.requestId, f.snapshot(3, "New publication"));
  opening.reply.resolve(f.snapshot(1, "Old response"));
  await turn();
  expect(f.query.getSnapshot().data?.title).toBe("New publication");
  const pending = f.query.read();
  const read = f.calls.find((call) => call.input.operation === "read")!;
  f.emit(opening.input.requestId, f.snapshot(5, "Newest"));
  read.reply.resolve(f.snapshot(4, "Older finite read"));
  expect(await pending).toEqual({ title: "Newest" });
  stop();
  f.client.queries.dispose();
});

test("duplicate callbacks retain independent memberships and an older observation cannot affect its replacement", async () => {
  const f = bridge();
  const listener = () => {};
  const first = f.query.subscribe(listener);
  const peer = f.query.subscribe(listener);
  const old = f.calls[0]!;
  first();
  expect(f.calls.filter((call) => call.input.operation === "close")).toHaveLength(0);
  peer();
  const stop = f.query.subscribe(listener);
  const current = [...f.calls].reverse().find((call) => call.input.operation === "observe")!;
  expect(current.input.requestId).not.toBe(old.input.requestId);
  f.emit(current.input.requestId, f.snapshot(2, "Current"));
  f.emit(old.input.requestId, f.snapshot(99, "Closed"));
  old.reply.resolve(f.snapshot(100, "Old open response"));
  current.reply.resolve(f.snapshot(1, "Delayed current response"));
  await turn();
  expect(f.query.getSnapshot().data?.title).toBe("Current");
  stop();
  f.client.queries.dispose();
});

test("a response from a replaced host generation cannot overwrite the new generation", async () => {
  const f = bridge();
  const pending = f.query.read();
  const oldRead = f.calls[0]!;
  const stop = f.query.subscribe(() => {});
  const opening = f.calls[1]!;
  f.emit(opening.input.requestId, f.snapshot(1, "Replacement", 2));
  oldRead.reply.resolve(f.snapshot(99, "Retired generation", 1));
  expect(await pending).toEqual({ title: "Replacement" });
  opening.reply.resolve(f.snapshot(1, "Replacement", 2));
  stop();
  f.client.queries.dispose();
});

test("a delayed observation error cannot replace a newer healthy publication", async () => {
  const f = bridge();
  const stop = f.query.subscribe(() => {});
  const opening = f.calls[0]!;
  f.emit(opening.input.requestId, f.snapshot(3, "Healthy"));
  opening.reply.reject(new Error("Late reply failure"));
  await turn();
  try {
    expect(f.query.getSnapshot().error).toBeUndefined();
  } finally {
    stop();
    f.client.queries.dispose();
  }
});

test("a successful unchanged snapshot clears a failed observation admission", async () => {
  const f = bridge();
  let stop = f.query.subscribe(() => {});
  const first = f.calls[0]!;
  first.reply.resolve(f.snapshot(3, "Healthy"));
  await turn();
  stop();
  stop = f.query.subscribe(() => {});
  const opening = [...f.calls].reverse().find((call) => call.input.operation === "observe")!;
  opening.reply.reject(new Error("Lost bridge reply"));
  await turn();
  expect(f.query.getSnapshot().error?.message).toBe("Lost bridge reply");
  const pending = f.query.read();
  f.calls.find((call) => call.input.operation === "read")!.reply.resolve(f.snapshot(3, "Healthy"));
  try {
    expect(await pending).toEqual({ title: "Healthy" });
    expect(f.query.getSnapshot().error).toBeUndefined();
  } finally {
    stop();
    f.client.queries.dispose();
  }
});

test("a later host generation wins when an evicted generation reply arrives first", async () => {
  const f = bridge();
  const old = f.query.read();
  const oldReply = f.calls[0]!;
  const newer = f.query.read();
  const newReply = f.calls[1]!;
  oldReply.reply.resolve(f.snapshot(9, "Old evicted source", 1));
  await old;
  newReply.reply.resolve(f.snapshot(1, "New source", 2));
  try {
    expect(await newer).toEqual({ title: "New source" });
  } finally {
    f.client.queries.dispose();
  }
});

test("abort settles a finite caller before a delayed bridge reply and prevents late publication", async () => {
  const f = bridge();
  const abort = new AbortController();
  let settled = false;
  const pending = f.query.read(abort.signal).catch((error) => {
    settled = true;
    return error;
  });
  const reply = f.calls[0]!;
  abort.abort(new Error("No longer observed"));
  await turn();
  try {
    expect(settled).toBe(true);
  } finally {
    reply.reply.resolve(f.snapshot(1, "Late"));
    await pending;
    f.client.queries.dispose();
  }
});

test("finite query settlement enforces the inactive bound without another observation or lookup", async () => {
  const f = bridge();
  const active = [];
  const pending = [];
  for (let index = 0; index < 130; index++) {
    const query = f.client.queries.command({ kind: "command", extensionId: "example.tool", id: `read-${index}` });
    active.push(query);
    pending.push(query.read());
  }
  for (const call of f.calls.filter((call) => call.input.operation === "read"))
    call.reply.resolve(f.snapshot(1, "Accepted"));
  await Promise.all(pending);
  await turn();
  try {
    expect(active.filter((query) => !query.isDisposed()).length).toBeLessThanOrEqual(128);
  } finally {
    f.client.queries.dispose();
  }
});

test("authority retirement clears data synchronously and fences pending read and observation replies", async () => {
  const f = bridge();
  const stop = f.query.subscribe(() => {});
  const opening = f.calls[0]!;
  f.emit(opening.input.requestId, f.snapshot(1, "Private"));
  const pending = f.query.read();
  let closed = false;
  void pending.catch(() => {
    closed = true;
  });
  const read = f.calls.find((call) => call.input.operation === "read")!;
  f.rotate();
  expect(f.query.isDisposed()).toBe(true);
  expect(f.query.getSnapshot().data).toBeUndefined();
  await turn();
  expect(closed).toBe(true);
  opening.reply.resolve(f.snapshot(2, "Old account"));
  read.reply.resolve(f.snapshot(3, "Old account"));
  await expect(pending).rejects.toThrow("closed");
  await turn();
  expect(f.query.getSnapshot().data).toBeUndefined();
  stop();
  f.client.queries.dispose();
});

test("a prepared command query keeps the parameters that defined its identity", async () => {
  const f = bridge();
  const params = { name: "Original" };
  const query = f.client.queries.command({ kind: "command", extensionId: "example.tool", id: "read" }, params);
  params.name = "Changed later";
  const pending = query.read();
  const request = f.calls.find((call) => call.input.operation === "read")!;
  try {
    expect((request.input.command as { params: unknown }).params).toEqual({ name: "Original" });
  } finally {
    request.reply.resolve(f.snapshot(1, "Accepted"));
    await pending;
    f.client.queries.dispose();
  }
});

test("the supported extension override qualifies command query events before admission", async () => {
  const f = bridge();
  const host = { ...f.host, extensionId: undefined };
  const client = createWebviewClient(host, { extensionId: "override.tool" });
  const query = client.queries.command({ kind: "command", extensionId: "override.tool", id: "read" }, undefined, {
    events: [{ kind: "event", id: "changed" }],
  });
  const stop = query.subscribe(() => {});
  const opening = f.calls.find((call) => call.input.operation === "observe")!;
  try {
    expect(opening.input.dependsOn).toEqual(["override.tool.event.changed"]);
  } finally {
    opening.reply.resolve(f.snapshot(1, "Accepted"));
    await turn();
    stop();
    client.queries.dispose();
    f.client.queries.dispose();
  }
});
