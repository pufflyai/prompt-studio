import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";

test("new sessions expose empty history sources and queued messages before a provider starts", async () => {
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Session reads" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "New session",
      agent: "unavailable",
    });
    const sources = await handle.app.request(`/v1/sessions/${session.id}/conversation/sources`);
    const queued = await handle.app.request(`/v1/sessions/${session.id}/queued-messages`);
    expect(sources.status).toBe(200);
    expect(queued.status).toBe(200);
    expect(await sources.json()).toEqual({
      checkpoint: null,
      native: null,
      checkpointError: null,
      nativeError: null,
    });
    expect(await queued.json()).toMatchObject({
      messages: [],
      queue: { requests: [], steeringAvailable: false },
    });
  } finally {
    await handle.close();
  }
});
