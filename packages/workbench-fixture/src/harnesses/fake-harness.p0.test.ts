import { expect, test } from "bun:test";
import type {
  HarnessContext,
  HarnessEventSink,
  JsonPatch,
  SessionMessage,
} from "@pstdio/sdk/extensions";
import { createFakeHarness } from "./fake-harness";

const ctx: HarnessContext = {
  extensionId: "pstdio.workbench-fixture",
  name: "workbench-fixture",
  connections: {
    request: async () => {
      throw new Error("No connections are configured in this test");
    },
    stream: async function* () {
      yield { type: "end" } as const;
    },
  },
  process: {
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
};

const recordingSink = (initial: SessionMessage[] = []) => {
  const patches: JsonPatch[] = [];
  const messages = [...initial];
  const sink: HarnessEventSink = {
    push: (patch) => {
      patches.push(patch);
      const index = Number(patch.path.slice("/messages/".length));
      messages[index] = patch.value as SessionMessage;
    },
    getMessages: () => messages,
  };
  return { patches, sink };
};

test("a restarted fake harness resumes from the saved conversation without sparse native history", async () => {
  const first = createFakeHarness();
  const started = await first.start(ctx, { prompt: "Keep this turn", sessionId: "host", events: recordingSink().sink });
  await started.done;
  const saved = await first.getMessages(ctx, { agentSessionId: started.agentSessionId! });
  const restarted = createFakeHarness();
  const { sink } = recordingSink(saved);
  const resumed = await restarted.resume(ctx, {
    agentSessionId: started.agentSessionId!,
    sessionId: "host",
    prompt: "After restart",
    messageOffset: saved.length,
    events: sink,
  });
  await resumed.done;
  expect(await restarted.getMessages(ctx, { agentSessionId: started.agentSessionId! })).toEqual(sink.getMessages());
});
