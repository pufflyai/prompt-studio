import { describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

const writeControlledHarnessExtension = (repoRoot: string) => {
  const extensionDir = join(repoRoot, ".pstdio", "extensions", "pstdio.harness.fake");
  mkdirSync(extensionDir, { recursive: true });
  writeFileSync(
    join(extensionDir, "extension.ts"),
    `const state = globalThis.__pstdioHarnessSessionLifecycleTest;

const pushTextPair = (eventStore, sessionId, prompt, offset) => {
  eventStore?.push({
    op: "add",
    path: \`/messages/\${offset}\`,
    value: { id: \`\${sessionId}-\${offset}\`, role: "user", parts: [{ type: "text", text: prompt }], index: offset },
  });
  eventStore?.push({
    op: "add",
    path: \`/messages/\${offset + 1}\`,
    value: {
      id: \`\${sessionId}-\${offset + 1}\`,
      role: "assistant",
      parts: [{ type: "text", text: \`done: \${prompt}\` }],
      index: offset + 1,
    },
  });
};

const createProcess = (sessionId, exit) => ({
  sessionId,
  stdin: { write() {}, end() {} },
  kill() {
    state.kill();
    exit.resolve({ code: null, signal: "SIGTERM" });
  },
  onExit: exit.promise,
});

export default {
  id: "pstdio.harness.fake",
  name: "Fake Harness",
  harnesses: {
    fake: {
      id: "pstdio.harness.fake",
      label: "Fake Harness",
      async detect() {
        return { available: true };
      },
      listModels() {
        return [{ id: "fake" }];
      },
      async startSession(_ctx, input) {
        const exit = state.createExit();
        pushTextPair(input.eventStore, "fake-run-1", input.prompt, 0);
        return { sessionId: "fake-run-1", process: createProcess("fake-run-1", exit) };
      },
      async resumeSession(_ctx, input, eventStore) {
        const exit = state.createExit();
        pushTextPair(eventStore, input.sessionId, input.prompt, input.messageOffset ?? 0);
        return { process: createProcess(input.sessionId, exit) };
      },
      async getMessages() {
        return [];
      },
      async start(_ctx, input) {
        return { runId: input.sessionId };
      },
    },
  },
};
`,
  );
};

const waitForSessionStatus = async (
  app: Awaited<ReturnType<typeof createApp>>["app"],
  sessionId: string,
  expectedStatus: string,
) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await app.request(`/v1/sessions/${sessionId}`);
    expect(response.status).toBe(200);
    const session = await response.json();
    if (session.status === expectedStatus) return session;
    await Bun.sleep(20);
  }

  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

const waitForSessionStoreRemoval = (
  sessionService: Awaited<ReturnType<typeof createApp>>["deps"]["sessionService"],
  sessionId: string,
) => {
  const { promise, resolve } = Promise.withResolvers<void>();
  const originalRemove = sessionService.store.remove;

  sessionService.store.remove = (removedSessionId: string) => {
    originalRemove(removedSessionId);
    if (removedSessionId === sessionId) resolve();
  };

  if (!sessionService.store.get(sessionId)) resolve();

  return Promise.race([
    promise,
    Bun.sleep(500).then(() => {
      throw new Error("Timed out waiting for session store cleanup");
    }),
  ]);
};

describe("harness session ingress", () => {
  test("starts, sends to, and stops an extension-backed harness session", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-harness-session-test-"));
    const repoRoot = join(tempRoot, "repo");
    mkdirSync(repoRoot, { recursive: true });
    writeControlledHarnessExtension(repoRoot);
    const exits: Deferred<{ code: number | null; signal: string | null }>[] = [];
    const kill = mock(() => {});
    const state = {
      kill,
      createExit: () => {
        const exit = createDeferred<{ code: number | null; signal: string | null }>();
        exits.push(exit);
        return exit;
      },
    };
    (globalThis as unknown as Record<string, unknown>).__pstdioHarnessSessionLifecycleTest = state;
    const handle = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
    });

    try {
      const projectResponse = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Harness Project", agents: ["pstdio.harness.fake"] }),
      });
      expect(projectResponse.status).toBe(201);
      const project = await projectResponse.json();

      const repoResponse = await handle.app.request(`/v1/projects/${project.id}/repos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "repo", path: repoRoot }),
      });
      expect(repoResponse.status).toBe(201);

      const infoResponse = await handle.app.request(`/v1/harnesses/info?project_id=${project.id}`);
      expect(infoResponse.status).toBe(200);
      expect(await infoResponse.json()).toContainEqual({
        id: "pstdio.harness.fake",
        name: "Fake Harness",
        extension_id: "pstdio.harness.fake",
        availability: { type: "INSTALLED" },
      });

      const modelsResponse = await handle.app.request(
        `/v1/harnesses/pstdio.harness.fake/models?project_id=${project.id}`,
      );
      expect(modelsResponse.status).toBe(200);
      expect(await modelsResponse.json()).toEqual([{ id: "fake" }]);

      const startResponse = await handle.app.request("/v1/harnesses/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Harness start",
          prompt: "start",
          harness: "pstdio.harness.fake",
        }),
      });
      expect(startResponse.status).toBe(201);
      const session = await startResponse.json();
      expect(session.agent).toBe("pstdio.harness.fake");
      expect(exits).toHaveLength(1);

      exits[0]!.resolve({ code: 0, signal: null });
      await waitForSessionStatus(handle.app, session.id, "completed");

      const sendResponse = await handle.app.request(`/v1/harnesses/sessions/${session.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "follow-up", harness: "pstdio.harness.fake" }),
      });
      expect(sendResponse.status).toBe(200);
      expect(await sendResponse.json()).toMatchObject({ id: session.id, agent: "pstdio.harness.fake" });
      expect(exits).toHaveLength(2);

      const storeRemoved = waitForSessionStoreRemoval(handle.deps.sessionService, session.id);
      const stopResponse = await handle.app.request(`/v1/harnesses/sessions/${session.id}/stop`, {
        method: "POST",
      });
      expect(stopResponse.status).toBe(200);
      expect(await stopResponse.json()).toMatchObject({ id: session.id, status: "cancelled" });
      expect(kill).toHaveBeenCalled();

      const finalSession = await waitForSessionStatus(handle.app, session.id, "cancelled");
      await storeRemoved;
      expect(finalSession.agent).toBe("pstdio.harness.fake");
    } finally {
      await handle.close();
      delete (globalThis as unknown as Record<string, unknown>).__pstdioHarnessSessionLifecycleTest;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
