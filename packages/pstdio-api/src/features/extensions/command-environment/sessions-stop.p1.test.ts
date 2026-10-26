import { afterAll, beforeAll, expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { inertSessionChannelHooks } from "../../sessions/session-store.test-utils";
import { createSessionsApi } from "./sessions";

let handle: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  handle = await createTestApp();
});
afterAll(async () => handle.close());

const fixture = async () => {
  const project = await handle.deps.projectService.create({ name: "Extension stop" });
  const service = handle.deps.sessionService;
  const api = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "ES" } });
  return { project, service, api };
};

for (const status of ["queued", "in_progress", "awaiting_input"] as const) {
  test(`extensions stop ${status} work and cancel its queued follow-ups`, async () => {
    const { project, service, api } = await fixture();
    const row = await service.createQueuedWithEntry({
      project_id: project.id,
      title: status,
      agent: "test",
      prompt: "Initial request",
      request_kind: "start",
    });
    if (status !== "queued") {
      await service.resume(row.id);
      await service.insertEntryForActive({ id: row.id, prompt: "Follow up", request_kind: "follow_up" });
      if (status === "awaiting_input") await service.transitionStatus(row.id, status);
    }
    expect(await handle.deps.sessionQueueEntriesService.listPendingBySession(row.id)).not.toBeEmpty();
    await api.stop(row.id);
    expect(await api.get(row.id)).toMatchObject({ status: "cancelled", lastExit: { cause: "user_stop" } });
    expect(await handle.deps.sessionQueueEntriesService.listPendingBySession(row.id)).toBeEmpty();
  });
}

test("extension stop waits for harness acknowledgement and propagates stop failures", async () => {
  const { project, service, api } = await fixture();
  const row = await service.create({ project_id: project.id, title: "Acknowledgement", agent: "test" });
  const stopping = Promise.withResolvers<void>();
  const stopped = Promise.withResolvers<void>();
  service.store.create(row.id, inertSessionChannelHooks);
  service.store.setSession(row.id, {
    done: new Promise(() => {}),
    stop: async () => {
      stopping.resolve();
      await stopped.promise;
    },
  });
  const cancellation = api.stop(row.id);
  await stopping.promise;
  expect((await service.get(row.id))?.status).toBe("in_progress");
  stopped.reject(new Error("Native stop failed"));
  await expect(cancellation).rejects.toThrow("Native stop failed");
  expect((await service.get(row.id))?.status).toBe("in_progress");
  service.store.setSession(row.id, { done: new Promise(() => {}), stop: async () => {} });
  await api.stop(row.id);
  expect((await service.get(row.id))?.status).toBe("cancelled");
});

test("extension stop rejects a replacement execution instead of claiming it stopped", async () => {
  const { project, service, api } = await fixture();
  const row = await service.create({ project_id: project.id, title: "Replacement", agent: "test" });
  const stopping = Promise.withResolvers<void>();
  const stopped = Promise.withResolvers<void>();
  service.store.create(row.id, inertSessionChannelHooks);
  service.store.setSession(row.id, {
    done: new Promise(() => {}),
    stop: async () => {
      stopping.resolve();
      await stopped.promise;
    },
  });
  const cancellation = api.stop(row.id);
  await stopping.promise;
  const replacement = service.store.create(row.id, inertSessionChannelHooks);
  await service.resume(row.id);
  stopped.resolve();
  await expect(cancellation).rejects.toThrow("Session execution changed before stopping");
  expect((await service.get(row.id))?.status).toBe("in_progress");
  expect(replacement.cancellationRequested).toBe(false);
});

test("extension stop cannot mutate foreign or missing sessions or run after command cancellation", async () => {
  const { service, api } = await fixture();
  const foreign = await handle.deps.projectService.create({ name: "Foreign" });
  const row = await service.create({ project_id: foreign.id, title: "Foreign", agent: "test" });
  await expect(api.stop(row.id)).rejects.toThrow("Session not found");
  await expect(api.stop("missing")).rejects.toThrow("Session not found");
  const controller = new AbortController();
  controller.abort();
  const cancelled = createSessionsApi(handle.deps, {
    projectId: foreign.id,
    project: { ...foreign, shorthand: "F" },
    signal: controller.signal,
  });
  await expect(cancelled.stop(row.id)).rejects.toThrow();
  expect((await service.get(row.id))?.status).toBe("in_progress");
});
