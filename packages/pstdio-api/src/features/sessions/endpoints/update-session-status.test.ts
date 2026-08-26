import { describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessExit } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

const FAKE_ID = testHarnessId("fake");

const createCancellableRegistry = (stop: ReturnType<typeof mock>, done: Promise<HarnessExit>) =>
  createTestHarnessRegistry([
    createTestHarnessRecord("fake", {
      provider: {
        start: () => ({
          agentSessionId: "agent-session-1",
          done,
          stop: stop as () => void,
        }),
        getMessages: () => [],
      },
    }),
  ]);

const waitForCall = async (fn: ReturnType<typeof mock>) => {
  for (let index = 0; index < 20; index += 1) {
    if (fn.mock.calls.length > 0) return;
    await Bun.sleep(10);
  }

  throw new Error("Timed out waiting for call");
};

const waitForAgentSessionId = async (app: Awaited<ReturnType<typeof createTestApp>>["app"], sessionId: string) => {
  for (let index = 0; index < 20; index += 1) {
    const res = await app.request(`/v1/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    const session = await res.json();
    if (session.agent_session_id === "agent-session-1") return;
    await Bun.sleep(10);
  }

  throw new Error("Timed out waiting for agent session id");
};

const waitForSessionStoreRemoval = (
  sessionService: Awaited<ReturnType<typeof createTestApp>>["deps"]["sessionService"],
  sessionId: string,
) => {
  const { promise, resolve } = Promise.withResolvers<void>();
  const originalRemove = sessionService.store.remove;

  sessionService.store.remove = (removedSessionId: string) => {
    originalRemove(removedSessionId);
    if (removedSessionId === sessionId) {
      resolve();
    }
  };

  if (!sessionService.store.get(sessionId)) {
    resolve();
  }

  return Promise.race([
    promise,
    Bun.sleep(500).then(() => {
      throw new Error("Timed out waiting for session store cleanup");
    }),
  ]);
};

describe("PATCH /v1/sessions/:id/status", () => {
  test("cancelled kills the active process and does not get overwritten on process exit", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-update-session-status-test-"));
    const { promise: done, resolve: resolveExit } = Promise.withResolvers<HarnessExit>();
    const stop = mock(() => {});
    const handle = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage"),
      harnessRegistry: createCancellableRegistry(stop, done),
    });

    try {
      const projectRes = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Cancel Session Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const createRes = await handle.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Cancel me",
          prompt: "keep running",
          agent: FAKE_ID,
        }),
      });
      expect(createRes.status).toBe(201);
      const session = await createRes.json();
      await waitForAgentSessionId(handle.app, session.id);

      const cancelRes = await handle.app.request(`/v1/sessions/${session.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      expect(cancelRes.status).toBe(200);
      expect(await cancelRes.json()).toMatchObject({ id: session.id, status: "cancelled" });

      const activityRes = await handle.app.request(`/v1/sessions/${session.id}/activity`);
      expect(activityRes.status).toBe(200);
      const activity = (await activityRes.json()) as {
        events: Array<{ event_type: string; payload_json: { to_status?: string } }>;
      };
      expect(activity.events[0].event_type).toBe("session_status_updated");
      expect(activity.events[0].payload_json.to_status).toBe("cancelled");

      await waitForCall(stop);
      const storeRemoved = waitForSessionStoreRemoval(handle.deps.sessionService, session.id);
      resolveExit({ status: "completed" });
      await storeRemoved;

      const finalRes = await handle.app.request(`/v1/sessions/${session.id}`);
      expect(finalRes.status).toBe(200);
      expect(await finalRes.json()).toMatchObject({ id: session.id, status: "cancelled" });
    } finally {
      await handle.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("does not emit duplicate activity when status is unchanged", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-update-session-status-noop-test-"));
    const handle = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage"),
      harnessRegistry: createTestHarnessRegistry([]),
    });

    try {
      const projectRes = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "No-op Status Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const session = await handle.deps.sessionService.create({
        project_id: project.id,
        title: "No-op Session",
        agent: FAKE_ID,
      });

      const firstStatusRes = await handle.app.request(`/v1/sessions/${session.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "awaiting_input" }),
      });
      expect(firstStatusRes.status).toBe(200);

      const secondStatusRes = await handle.app.request(`/v1/sessions/${session.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "awaiting_input" }),
      });
      expect(secondStatusRes.status).toBe(200);

      const activityRes = await handle.app.request(
        `/v1/sessions/${session.id}/activity?event_type=session_status_updated`,
      );
      expect(activityRes.status).toBe(200);
      const activity = (await activityRes.json()) as {
        events: Array<{ event_type: string; payload_json?: { to_status?: string } }>;
      };
      const awaitingInputEvents = activity.events.filter(
        (event) => event.event_type === "session_status_updated" && event.payload_json?.to_status === "awaiting_input",
      );
      expect(awaitingInputEvents).toHaveLength(1);
    } finally {
      await handle.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("rejects queued status because queue ownership belongs to the scheduler", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-update-session-status-queued-test-"));
    const handle = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage"),
      harnessRegistry: createTestHarnessRegistry([]),
    });

    try {
      const projectRes = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Queued Reject Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const session = await handle.deps.sessionService.create({
        project_id: project.id,
        title: "Queued Reject Session",
        agent: FAKE_ID,
      });

      const statusRes = await handle.app.request(`/v1/sessions/${session.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "queued" }),
      });

      expect(statusRes.status).toBe(400);
    } finally {
      await handle.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("removes queue entries when queued sessions transition to terminal statuses", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-update-queued-terminal-test-"));
    const handle = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage"),
      harnessRegistry: createTestHarnessRegistry([]),
    });

    try {
      const projectRes = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Queued Terminal Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      for (const status of ["completed", "failed", "disconnected"] as const) {
        const queued = await handle.deps.sessionService.createQueuedWithEntry(
          {
            project_id: project.id,
            title: `Queued ${status}`,
            agent: FAKE_ID,
            prompt: `queue then ${status}`,
            request_kind: "start",
          },
          { emitStartedHook: false },
        );

        expect(await handle.deps.sessionQueueEntriesService.listPending()).toContainEqual(
          expect.objectContaining({ session_id: queued.id }),
        );

        const statusRes = await handle.app.request(`/v1/sessions/${queued.id}/status`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        });
        expect(statusRes.status).toBe(200);
        expect(await statusRes.json()).toMatchObject({ id: queued.id, status });

        expect(await handle.deps.sessionQueueEntriesService.listPending()).not.toContainEqual(
          expect.objectContaining({ session_id: queued.id }),
        );
        expect(await handle.deps.sessionQueueEntriesService.listDispatchStarted()).not.toContainEqual(
          expect.objectContaining({ session_id: queued.id }),
        );
      }
    } finally {
      await handle.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
