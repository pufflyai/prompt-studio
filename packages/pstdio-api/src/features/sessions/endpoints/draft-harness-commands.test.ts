import { expect, test } from "bun:test";
import { realpath } from "node:fs/promises";
import type { HarnessCommandContext } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("a new conversation discovers native commands without creating a session or starting a turn", async () => {
  let starts = 0;
  const discovered: unknown[] = [];
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("draft-commands", {
      provider: {
        params: { planning: { type: "boolean", defaultValue: false } },
        getCommandState: (ctx, input) => {
          discovered.push({ projectId: ctx.projectId, ...input });
          return { slashCommands: true, commands: [{ name: "/plan", description: "Plan" }], modes: [] };
        },
        start: () => {
          starts++;
          throw new Error("Discovery must not start a turn.");
        },
      },
    }),
  ]);
  const app = await createTestApp({ harnessRegistry: registry });
  try {
    const folder = folderProjectInput({ name: "Draft commands" });
    const project = await (
      await app.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folder),
      })
    ).json();
    const response = await app.app.request("/v1/sessions/harness-command-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        agent: testHarnessId("draft-commands"),
        model: "fake",
        params: { planning: true },
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      harnessId: testHarnessId("draft-commands"),
      slashCommands: true,
      commands: [{ name: "/plan", description: "Plan" }],
      modes: [],
    });
    expect(discovered).toEqual([
      expect.objectContaining({
        projectId: project.id,
        cwd: await realpath(folder.initial_workspace.params.path),
        model: "fake",
        params: { planning: true },
      }),
    ]);
    expect(discovered[0]).not.toHaveProperty("sessionId");
    expect(starts).toBe(0);
    expect(await app.deps.sessionService.list(project.id)).toHaveLength(0);
    const invalid = await app.app.request("/v1/sessions/harness-command-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, agent: testHarnessId("draft-commands"), workspace_id: "missing" }),
    });
    expect(invalid.status).toBe(404);
  } finally {
    await app.close();
  }
});

for (const execution of ["control", "exclusive"] as const) {
  test(`a first-message native ${execution} operation creates its session without a synthetic prompt`, async () => {
    let starts = 0;
    const operations: { input: HarnessCommandContext; text: string }[] = [];
    const registry = createTestHarnessRegistry([
      createTestHarnessRecord("first-command", {
        provider: {
          start: () => {
            starts++;
            throw new Error("Commands must not start an ordinary prompt.");
          },
          prepareOperation: (_ctx, input, operation) => ({
            execution,
            invoke: async () => {
              operations.push({ input, text: operation.kind === "command" ? operation.text : "" });
              return execution === "control"
                ? { kind: "completed", params: { planning: true }, message: "Planning selected" }
                : {
                    kind: "started",
                    session: {
                      agentSessionId: "native-first",
                      done: Promise.resolve({ status: "completed" }),
                      stop: () => {},
                    },
                  };
            },
          }),
        },
      }),
    ]);
    const app = await createTestApp({ harnessRegistry: registry });
    let startedHooks = 0;
    let resumedHooks = 0;
    const emitStartedHook = app.deps.sessionService.emitStartedHook.bind(app.deps.sessionService);
    const emitResumedHook = app.deps.sessionService.emitResumedHook.bind(app.deps.sessionService);
    app.deps.sessionService.emitStartedHook = (session) => {
      startedHooks++;
      emitStartedHook(session);
    };
    app.deps.sessionService.emitResumedHook = (session) => {
      resumedHooks++;
      emitResumedHook(session);
    };
    try {
      const project = await (
        await app.app.request("/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: "First command" })),
        })
      ).json();
      const response = await app.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Native command",
          agent: testHarnessId("first-command"),
          operation: { kind: "command", text: "/plan task" },
        }),
      });
      expect(response.status).toBe(201);
      const session = await response.json();
      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual({ input: expect.objectContaining({ sessionId: session.id }), text: "/plan task" });
      expect(starts).toBe(0);
      expect(startedHooks).toBe(1);
      expect(resumedHooks).toBe(0);
      for (let i = 0; app.deps.sessionService.store.get(session.id) && i < 50; i++) await Bun.sleep(10);
      const saved = await app.deps.sessionService.get(session.id);
      expect(saved?.status).toBe("completed");
      expect(saved?.agent_session_id).toBe(execution === "exclusive" ? "native-first" : null);
      if (execution === "control") expect(saved?.params_json).toEqual({ planning: true });
      if (execution === "control")
        expect(session.operation_result).toEqual({ status: "completed", message: "Planning selected" });
      const retry = await app.app.request(`/v1/sessions/${session.id}/harness-commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: { kind: "command", text: "/plan again" } }),
      });
      expect(retry.status).toBe(200);
      expect(startedHooks).toBe(1);
      expect(resumedHooks).toBe(1);
      for (let i = 0; app.deps.sessionService.store.get(session.id) && i < 50; i++) await Bun.sleep(10);
    } finally {
      await app.close();
    }
  });
}

test("a rejected first operation returns a failed conversation that can be retried in place", async () => {
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("reject-first", {
      provider: {
        prepareOperation: (_ctx, _input, operation) => {
          if (operation.kind === "command" && operation.text === "/unknown")
            throw new Error("Unsupported native command");
          return { execution: "control", invoke: async () => ({ kind: "completed", params: { planning: true } }) };
        },
      },
    }),
  ]);
  const app = await createTestApp({ harnessRegistry: registry });
  try {
    const project = await (
      await app.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Rejected command" })),
      })
    ).json();
    const response = await app.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "First command",
        agent: testHarnessId("reject-first"),
        operation: { kind: "command", text: "/unknown" },
      }),
    });
    expect(response.status).toBe(201);
    const session = await response.json();
    expect(session).toMatchObject({ status: "failed", operation_result: { message: "Unsupported native command" } });
    expect((await app.deps.sessionService.list(project.id)).map((row) => row.status)).toEqual(["failed"]);
    const retry = await app.app.request(`/v1/sessions/${session.id}/harness-commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: { kind: "command", text: "/plan" } }),
    });
    expect(retry.status).toBe(200);
    for (let i = 0; app.deps.sessionService.store.get(session.id) && i < 50; i++) await Bun.sleep(10);
    expect((await app.deps.sessionService.get(session.id))?.params_json).toEqual({ planning: true });
    expect(await app.deps.sessionService.list(project.id)).toHaveLength(1);
  } finally {
    await app.close();
  }
});

test("cancelling first native startup keeps the cancelled status and accepted native identity", async () => {
  const startup = Promise.withResolvers<void>();
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("cancel-first", {
      provider: {
        prepareOperation: () => ({
          execution: "exclusive",
          invoke: async ({ signal }) => {
            startup.resolve();
            await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
            return {
              kind: "started",
              session: {
                agentSessionId: "cancelled-first",
                done: Promise.resolve({ status: "cancelled" }),
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
        body: JSON.stringify(folderProjectInput({ name: "Cancelled first command" })),
      })
    ).json();
    const abort = new AbortController();
    const response = app.app.request("/v1/sessions", {
      method: "POST",
      signal: abort.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "First command",
        agent: testHarnessId("cancel-first"),
        operation: { kind: "command", text: "/goal task" },
      }),
    });
    await startup.promise;
    abort.abort();
    expect((await response).status).toBe(201);
    const [session] = await app.deps.sessionService.list(project.id);
    expect(session).toMatchObject({ status: "cancelled", agent_session_id: "cancelled-first" });
  } finally {
    await app.close();
  }
});
