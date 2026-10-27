import { expect, test } from "bun:test";
import type { WSContext, WSEvents } from "hono/ws";
import type { HarnessAuthenticationServerMessage } from "pstdio-api-contracts";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { createHarnessAuthenticationWebSocketEvents } from "./authentication-socket";

const socket = () => {
  const messages: HarnessAuthenticationServerMessage[] = [];
  const closed = Promise.withResolvers<void>();
  return {
    messages,
    closed: closed.promise,
    ws: {
      send: (value: string) => messages.push(JSON.parse(value)),
      close: () => closed.resolve(),
    } as unknown as WSContext,
  };
};
const send = (events: WSEvents, ws: WSContext, value: unknown) =>
  events.onMessage?.({ data: JSON.stringify(value) } as MessageEvent, ws);

test("account replies reach only their owning provider and never appear in emitted frames", async () => {
  let received = "";
  const asked = Promise.withResolvers<void>();
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("auth", {
      provider: {
        authenticate: async (_ctx, _input, channel) => {
          const value = channel.request({ type: "input", title: "API key", secret: true });
          asked.resolve();
          received = await value;
        },
      },
    }),
  ]);
  const events = createHarnessAuthenticationWebSocketEvents({ harnessRegistry: registry });
  const peer = socket();
  send(events, peer.ws, { type: "open", agent: testHarnessId("auth"), input: { action: "login" } });
  await asked.promise;
  const prompt = peer.messages.find((m) => m.type === "prompt");
  if (prompt?.type !== "prompt") throw Error("Missing prompt");
  send(events, peer.ws, { type: "reply", requestId: prompt.requestId, value: "private-api-key" });
  await peer.closed;
  expect(received).toBe("private-api-key");
  expect(JSON.stringify(peer.messages)).not.toContain(received);
  expect(peer.messages.at(-1)).toEqual({ type: "completed" });
  await registry.dispose();
});

test("disconnect cancels a provider waiting for input", async () => {
  const ready = Promise.withResolvers<void>();
  const done = Promise.withResolvers<void>();
  let aborted = false;
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("auth", {
      provider: {
        authenticate: async (_ctx, _input, channel) => {
          try {
            const wait = channel.request({ type: "input", title: "Code", secret: true });
            ready.resolve();
            await wait;
          } finally {
            aborted = channel.signal.aborted;
            done.resolve();
          }
        },
      },
    }),
  ]);
  const events = createHarnessAuthenticationWebSocketEvents({ harnessRegistry: registry });
  const peer = socket();
  send(events, peer.ws, { type: "open", agent: testHarnessId("auth"), input: { action: "login" } });
  await ready.promise;
  events.onClose?.({} as CloseEvent, peer.ws);
  await done.promise;
  expect(aborted).toBe(true);
  await registry.dispose();
});

test("a disabled project harness cannot run account actions", async () => {
  let invoked = false;
  const registry = createTestHarnessRegistry(
    [
      createTestHarnessRecord("auth", {
        provider: {
          authenticate: () => {
            invoked = true;
          },
        },
      }),
    ],
    { disabledByProject: { project: [testHarnessId("auth")] } },
  );
  const peer = socket();
  const events = createHarnessAuthenticationWebSocketEvents({ harnessRegistry: registry });
  send(events, peer.ws, {
    type: "open",
    agent: testHarnessId("auth"),
    projectId: "project",
    input: { action: "login" },
  });
  await peer.closed;
  expect(invoked).toBe(false);
  expect(peer.messages.at(-1)).toMatchObject({ type: "error" });
  await registry.dispose();
});
