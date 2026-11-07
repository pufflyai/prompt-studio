import { expect, test } from "bun:test";
import { createSessionStreamConnections } from "./session-stream-connections";

const connection = () => {
  let disconnect = () => {};
  const events: Array<{ event?: string; data: string }> = [];
  const connections = createSessionStreamConnections();
  const id = connections.open({
    onAbort: (listener: () => void) => {
      disconnect = listener;
    },
    writeSSE: async (event: { event?: string; data: string }) => {
      events.push(event);
    },
  } as never);
  return { connections, id, events, disconnect: () => disconnect() };
};

test("client disconnection owns an abort-rejecting subscription and releases it without stopping work", async () => {
  const { connections, id, events, disconnect } = connection();
  let released = 0;
  connections.subscribe(id, "chat", async (sink) => {
    try {
      await new Promise<void>((_, reject) => sink.onAbort(() => reject(new DOMException("Closed", "AbortError"))));
    } finally {
      released++;
    }
  });
  disconnect();
  await Bun.sleep(0);
  expect(released).toBe(1);
  expect(events).toEqual([]);
  expect(connections.subscribe(id, "closed", async () => {})).toBe(false);
});

test("unexpected subscription failure reports its error and leaves the shared connection usable", async () => {
  const { connections, id, events, disconnect } = connection();
  connections.subscribe(id, "failed", async () => {
    throw new Error("Unexpected subscription failure");
  });
  await Bun.sleep(0);
  expect(events).toHaveLength(1);
  expect(events[0].event).toBe("error");
  expect(JSON.parse(events[0].data)).toMatchObject({
    subscription_id: "failed",
    data: { message: "Unexpected subscription failure" },
  });
  expect(
    connections.subscribe(id, "next", async (sink) => {
      await sink.write("ready", {});
    }),
  ).toBe(true);
  await Bun.sleep(0);
  expect(events.at(-1)?.event).toBe("ready");
  disconnect();
});
