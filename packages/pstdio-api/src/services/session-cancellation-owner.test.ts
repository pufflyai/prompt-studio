import { expect, test } from "bun:test";
import { createTestApp } from "../test-utils/create-test-app";

test("delayed cancellation cannot cancel a replacement conversation owner", async () => {
  const handle = await createTestApp();
  const stopping = Promise.withResolvers<void>();
  const stopped = Promise.withResolvers<void>();
  try {
    const service = handle.deps.sessionService;
    const project = await handle.deps.projectService.create({ name: "Cancellation owner" });
    const session = await service.create({ project_id: project.id, title: "Run", agent: "test" });
    const previous = service.store.create(session.id, () => {});
    service.store.setSession(session.id, {
      agentSessionId: "old",
      done: new Promise(() => {}),
      stop: async () => {
        stopping.resolve();
        await stopped.promise;
      },
    });
    const cancelling = service.cancel(session.id);
    await stopping.promise;
    const next = service.store.create(session.id, () => {});
    await service.resume(session.id);
    const before = await service.get(session.id);
    stopped.resolve();
    expect(await cancelling).toBeNull();
    expect(service.store.get(session.id)).toBe(next);
    expect(await service.get(session.id)).toEqual(before);
    expect(previous.cancellationRequested).toBe(true);
    expect(next.cancellationRequested).toBe(false);
  } finally {
    stopped.resolve();
    await handle.close();
  }
});
