import { expect, test } from "bun:test";

test("a rejected live write reports the watch failure and releases its hold without crashing its host", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
      import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
      import { watchConversation } from ${JSON.stringify(`${import.meta.dir}/watch.ts`)};
      import { nativeSubmissionIndex } from ${JSON.stringify(`${import.meta.dir}/native-submission.ts`)};
      let closed = 0;
      const controller = new AbortController();
      const queue = { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null };
      const ctx = makeCommandContext({
        storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }), params: {}, overrides: {
          signal: controller.signal,
          stream: { write: async (value) => {
            if ("fragment" in value) throw new Error("Presentation closed");
          } },
          sessions: {
            get: async () => ({ id: "s", projectId: "p", status: "completed", agent: "agent", params: {} }),
            getQueuedMessages: async () => ({ queue, messages: [] }),
            getExecutionState: async () => ({ kind: "local", available: true }),
            getForkState: async () => ({ supported: false, disabledReason: null }),
            getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
            retainResources: async () => ({ close: () => closed++ }),
            stream: async (_id, onEvent) => {
              await onEvent({ event: "patch", data: { op: "replace", path: "/messages", value: [] } });
              await onEvent({ event: "patch", data: { op: "add", path: "/messages/0", value: {
                id: "large", role: "assistant", parts: [{ type: "text", text: "x".repeat(70 * 1024) }],
              } } });
            },
          },
        },
      });
      let failure;
      try { await watchConversation(ctx, { type: "session", id: "s" }); }
      catch (error) { failure = error.message; }
      console.log(JSON.stringify({ closed, failure }));
    `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(stderr).toBe("");
  expect(code).toBe(0);
  expect(JSON.parse(stdout)).toEqual({ closed: 1, failure: "Presentation closed" });
});
