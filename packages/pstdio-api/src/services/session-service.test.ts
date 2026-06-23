import { describe, expect, mock, spyOn, test } from "bun:test";
import { apiLogger } from "../lib/logger";
import { createSessionService } from "./session-service";

const buildDeps = () => {
  const updateStatus = mock(async (id: string, status: string) => ({
    id,
    project_id: "project_1",
    status,
  }));
  const create = mock(async (input: { project_id: string; title: string; agent: string }) => ({
    id: "session_1",
    project_id: input.project_id,
    status: "in_progress",
    title: input.title,
    agent: input.agent,
  }));
  const archive = mock(async (id: string) => ({
    id,
    project_id: "project_1",
    status: "completed",
    archived: true,
  }));
  const cancelQueued = mock(async () => null);
  const archiveQueued = mock(async () => null);

  const emitted: unknown[][] = [];
  const eventBus = { emit: (...args: unknown[]) => emitted.push(args) };

  const onSessionStarted = mock(() => {});
  const onSessionStatusChanged = mock(() => {});
  const onSessionResumed = mock(() => {});

  const sessionsDb = {
    create,
    updateStatus,
    archive,
    get: mock(async () => null),
    list: mock(async () => []),
    listByStatus: mock(async () => []),
    update: mock(async () => null),
    cancelQueued,
    archiveQueued,
  };

  return {
    deps: {
      sessionsDb,
      eventBus,
      onSessionStarted,
      onSessionStatusChanged,
      onSessionResumed,
    } as unknown as Parameters<typeof createSessionService>[0],
    mocks: {
      updateStatus,
      create,
      archive,
      cancelQueued,
      archiveQueued,
      onSessionStarted,
      onSessionStatusChanged,
      onSessionResumed,
    },
    sessionsDb,
    emitted,
  };
};

describe("SessionService", () => {
  describe("transitionStatus", () => {
    test("updates DB, emits event, and fires status callback", async () => {
      const { deps, mocks, emitted } = buildDeps();
      const service = createSessionService(deps);

      const result = await service.transitionStatus("s1", "completed");

      expect(result).toMatchObject({ id: "s1", project_id: "project_1", status: "completed" });
      expect(mocks.updateStatus).toHaveBeenCalledWith("s1", "completed");
      expect(emitted).toContainEqual(["sessions", "set", { id: "s1", project_id: "project_1", status: "completed" }]);
      expect(mocks.onSessionStatusChanged).toHaveBeenCalledWith({
        id: "s1",
        project_id: "project_1",
        status: "completed",
      });
    });

    test("fires callback for failed status", async () => {
      const { deps, mocks } = buildDeps();
      const service = createSessionService(deps);

      await service.transitionStatus("s1", "failed");

      expect(mocks.onSessionStatusChanged).toHaveBeenCalledWith({
        id: "s1",
        project_id: "project_1",
        status: "failed",
      });
    });

    test("returns null when session not found", async () => {
      const { deps, sessionsDb } = buildDeps();
      (sessionsDb.updateStatus as ReturnType<typeof mock>).mockImplementation(async () => null);
      const service = createSessionService(deps);

      const result = await service.transitionStatus("missing", "completed");
      expect(result).toBeNull();
    });

    test("does not emit or fire callbacks when session not found", async () => {
      const { deps, sessionsDb, mocks, emitted } = buildDeps();
      (sessionsDb.updateStatus as ReturnType<typeof mock>).mockImplementation(async () => null);
      const service = createSessionService(deps);

      await service.transitionStatus("missing", "completed");

      expect(emitted).toHaveLength(0);
      expect(mocks.onSessionStatusChanged).not.toHaveBeenCalled();
    });

    test("warns when raw.updateStatus returns null so the missed emit is observable", async () => {
      const { deps, sessionsDb } = buildDeps();
      (sessionsDb.updateStatus as ReturnType<typeof mock>).mockImplementation(async () => null);
      const warnSpy = spyOn(apiLogger, "warn").mockImplementation(() => {});

      try {
        const service = createSessionService(deps);
        await service.transitionStatus("missing", "completed");

        expect(warnSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            event: "sync_emit_skipped",
            table: "sessions",
            op: "transitionStatus",
            id: "missing",
            reason: "no_row_updated",
          }),
          expect.any(String),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe("cancel", () => {
    test("stops the active harness session and transitions the session to cancelled", async () => {
      const { deps, mocks } = buildDeps();
      const service = createSessionService(deps);
      const stop = mock(() => {});

      service.store.create("s1", () => {});
      service.store.setSession("s1", {
        agentSessionId: "agent_1",
        done: new Promise(() => {}),
        stop,
      });

      const result = await service.cancel("s1");

      expect(stop).toHaveBeenCalledTimes(1);
      expect(mocks.updateStatus).toHaveBeenCalledWith("s1", "cancelled");
      expect(result).toMatchObject({ id: "s1", status: "cancelled" });
    });

    test("falls back to active cancellation when queued cancellation loses the dispatch race", async () => {
      const { deps, sessionsDb, mocks } = buildDeps();
      (sessionsDb.get as ReturnType<typeof mock>).mockImplementation(async () => ({ id: "s1", status: "queued" }));
      const service = createSessionService(deps);
      const stop = mock(() => {});

      service.store.create("s1", () => {});
      service.store.setSession("s1", {
        agentSessionId: "agent_1",
        done: new Promise(() => {}),
        stop,
      });

      const result = await service.cancel("s1");

      expect(mocks.cancelQueued).toHaveBeenCalledWith("s1");
      expect(stop).toHaveBeenCalledTimes(1);
      expect(mocks.updateStatus).toHaveBeenCalledWith("s1", "cancelled");
      expect(result).toMatchObject({ id: "s1", status: "cancelled" });
    });
  });

  describe("create", () => {
    test("creates session, emits event, and fires start callback", async () => {
      const { deps, mocks, emitted } = buildDeps();
      const service = createSessionService(deps);

      const result = await service.create({ project_id: "p1", title: "test", agent: "claude-code" });

      expect(result).toMatchObject({ id: "session_1", project_id: "p1" });
      expect(mocks.create).toHaveBeenCalledWith({ project_id: "p1", title: "test", agent: "claude-code" });
      expect(emitted).toContainEqual(["sessions", "set", expect.objectContaining({ id: "session_1" })]);
      expect(mocks.onSessionStarted).toHaveBeenCalledWith({
        id: "session_1",
        project_id: "p1",
        status: "in_progress",
      });
    });

    test("skips the start callback when requested", async () => {
      const { deps, mocks } = buildDeps();
      const service = createSessionService(deps);

      await service.create({ project_id: "p1", title: "test", agent: "claude-code" }, { emitStartedHook: false });

      expect(mocks.onSessionStarted).not.toHaveBeenCalled();
    });
  });

  describe("archive", () => {
    test("archives session and emits event", async () => {
      const { deps, mocks, emitted } = buildDeps();
      const service = createSessionService(deps);

      const result = await service.archive("s1");

      expect(result).toMatchObject({ id: "s1", archived: true });
      expect(mocks.archive).toHaveBeenCalledWith("s1");
      expect(emitted).toContainEqual(["sessions", "set", expect.objectContaining({ id: "s1", archived: true })]);
    });

    test("returns null when session not found", async () => {
      const { deps, sessionsDb, emitted } = buildDeps();
      (sessionsDb.archive as ReturnType<typeof mock>).mockImplementation(async () => null);
      const service = createSessionService(deps);

      const result = await service.archive("missing");
      expect(result).toBeNull();
      expect(emitted).toHaveLength(0);
    });

    test("falls back to regular archive when queued archive loses the dispatch race", async () => {
      const { deps, sessionsDb, mocks } = buildDeps();
      (sessionsDb.get as ReturnType<typeof mock>).mockImplementation(async () => ({ id: "s1", status: "queued" }));
      const service = createSessionService(deps);

      const result = await service.archive("s1");

      expect(mocks.archiveQueued).toHaveBeenCalledWith("s1");
      expect(mocks.archive).toHaveBeenCalledWith("s1");
      expect(result).toMatchObject({ id: "s1", archived: true });
    });
  });

  describe("resume", () => {
    test("transitions to in_progress and fires resume callback", async () => {
      const { deps, mocks, emitted } = buildDeps();
      const service = createSessionService(deps);

      const result = await service.resume("s1");

      expect(result).toMatchObject({ id: "s1", status: "in_progress" });
      expect(mocks.updateStatus).toHaveBeenCalledWith("s1", "in_progress");
      expect(emitted).toContainEqual(["sessions", "set", { id: "s1", project_id: "project_1", status: "in_progress" }]);
      expect(mocks.onSessionResumed).toHaveBeenCalledWith({
        id: "s1",
        project_id: "project_1",
        status: "in_progress",
      });
    });
  });
});
