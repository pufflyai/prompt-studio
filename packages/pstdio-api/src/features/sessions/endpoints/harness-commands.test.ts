import { expect, test } from "bun:test";
import type { HarnessExit } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("native controls work during a turn while exclusive commands cannot overlap it", async () => {
  const done = Promise.withResolvers<HarnessExit>();
  const inputs: string[] = [];
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("commands", {
      provider: {
        start: () => ({
          agentSessionId: "thread",
          done: done.promise,
          stop: () => {
            done.resolve({ status: "cancelled" });
          },
        }),
        getCommandState: () => ({
          commands: [{ name: "/compact", description: "Compact" }],
          modes: [],
          slashCommands: true,
        }),
        prepareOperation: (_ctx, _input, op) => ({
          execution: op.kind === "command" && op.text === "/compact" ? "exclusive" : "control",
          invoke: async () => {
            if (op.kind === "command") inputs.push(op.text);
            return { kind: "completed", message: "native result" };
          },
        }),
      },
    }),
  ]);
  let sessionId = "";
  const app = await createTestApp({ harnessRegistry: registry });
  try {
    const project = await (
      await app.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Commands" })),
      })
    ).json();
    const response = await app.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, title: "Work", prompt: "Work", agent: testHarnessId("commands") }),
    });
    const session = await response.json();
    sessionId = session.id;
    for (let i = 0; i < 50 && !app.deps.sessionService.store.get(session.id)?.session; i++) await Bun.sleep(10);
    const state = await app.app.request(`/v1/sessions/${session.id}/harness-commands`);
    expect(state.status).toBe(200);
    expect((await state.json()).commands[0].name).toBe("/compact");
    const invoke = (text: string) =>
      app.app.request(`/v1/sessions/${session.id}/harness-commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: { kind: "command", text } }),
      });
    expect((await invoke("/goal pause")).status).toBe(200);
    expect(inputs).toEqual(["/goal pause"]);
    expect((await invoke("/compact")).status).toBe(409);
    expect(inputs).toEqual(["/goal pause"]);
  } finally {
    done.resolve({ status: "completed" });
    for (let i = 0; app.deps.sessionService.store.get(sessionId) && i < 50; i++) await Bun.sleep(10);
    await app.close();
  }
});

test("stopping a command during native startup aborts delivery and releases its owner", async () => {
  const started = Promise.withResolvers<void>();
  let aborted = false;
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("pending-command", {
      provider: {
        prepareOperation: () => ({
          execution: "exclusive",
          invoke: async ({ signal }) => {
            started.resolve();
            await new Promise<void>((resolve) =>
              signal?.addEventListener(
                "abort",
                () => {
                  aborted = true;
                  resolve();
                },
                { once: true },
              ),
            );
            await Bun.sleep(20);
            return {
              kind: "started",
              session: {
                agentSessionId: "accepted-before-cancel",
                done: Promise.resolve({ status: "disconnected" }),
                stop: () => {},
              },
            };
          },
        }),
      },
    }),
  ]);
  const app = await createTestApp({ harnessRegistry: registry });

  try {
    const project = await (
      await app.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Startup cancellation" })),
      })
    ).json();
    const session = await (
      await app.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Commands",
          prompt: "Initialize",
          agent: testHarnessId("pending-command"),
        }),
      })
    ).json();
    if (!session.id) throw new Error(JSON.stringify(session));
    for (let i = 0; i < 100 && (await app.deps.sessionService.get(session.id))?.status === "in_progress"; i++)
      await Bun.sleep(10);
    const pending = Promise.resolve(
      app.app.request(`/v1/sessions/${session.id}/harness-commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: { kind: "command", text: "/compact" } }),
      }),
    );
    await Promise.race([
      started.promise,
      pending.then(async (response) => {
        throw new Error(await response.text());
      }),
    ]);
    await app.deps.sessionService.cancel(session.id);
    expect(aborted).toBe(true);
    await pending;
    expect((await app.deps.sessionService.get(session.id))?.status).toBe("cancelled");
    expect(app.deps.sessionService.store.get(session.id)).toBeNull();
    expect((await app.deps.sessionService.get(session.id))?.agent_session_id).toBe("accepted-before-cancel");
  } finally {
    await app.close();
  }
});

test("a completed native control cannot write parameters after the harness changes", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("first", {
      provider: {
        prepareOperation: () => ({
          execution: "control",
          invoke: async () => {
            entered.resolve();
            await release.promise;
            return { kind: "completed", params: { goal: true } };
          },
        }),
      },
    }),
    createTestHarnessRecord("second"),
  ]);
  const app = await createTestApp({ harnessRegistry: registry });
  try {
    const project = await (
      await app.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Control ownership" })),
      })
    ).json();
    const session = await (
      await app.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Control",
          prompt: "Hello",
          agent: testHarnessId("first"),
        }),
      })
    ).json();
    for (let i = 0; i < 100 && (await app.deps.sessionService.get(session.id))?.status === "in_progress"; i++)
      await Bun.sleep(10);
    const response = Promise.resolve(
      app.app.request(`/v1/sessions/${session.id}/harness-commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: { kind: "command", text: "/goal" } }),
      }),
    );
    await entered.promise;
    await app.deps.sessionService.update(session.id, { agent: testHarnessId("second"), params_json: {} });
    release.resolve();
    expect((await response).status).toBe(409);
    expect((await app.deps.sessionService.get(session.id))?.params_json).toEqual({});
  } finally {
    release.resolve();
    await app.close();
  }
});
