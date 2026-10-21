import { expect, test } from "bun:test";
import { createHarnessSessionResources } from "pstdio-api-runtime-host";
import { createTestApp } from "../../../test-utils/create-test-app";
import { openSessionStreamConnection } from "../../../test-utils/session-stream";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("retention distinguishes a deleted session from a disconnected stream", async () => {
  const handle = await createTestApp();
  const project = await handle.deps.projectService.create({ name: "Retention errors" });
  const session = await handle.deps.sessionService.create({ project_id: project.id, title: "Saved", agent: null });
  try {
    const retain = (sessionId: string) =>
      handle.app.request("/v1/session-stream/missing/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription_id: "tab", retain_session_id: sessionId }),
      });
    const deleted = await retain("deleted");
    expect(deleted.status).toBe(404);
    expect(await deleted.json()).toMatchObject({ code: "SESSION_NOT_FOUND" });
    const disconnected = await retain(session.id);
    expect(disconnected.status).toBe(404);
    expect(await disconnected.json()).toMatchObject({ code: "SESSION_STREAM_NOT_FOUND" });
  } finally {
    await handle.close();
  }
});

test("open client tabs retain completed session resources until the last client closes and the grace period ends", async () => {
  let now = 0;
  let expire: (() => void) | undefined;
  const resources = createHarnessSessionResources({
    now: () => now,
    schedule: (run) => {
      expire = run;
      return () => {
        expire = undefined;
      };
    },
  });
  const released: string[] = [];
  const registry = createTestHarnessRegistry(
    [
      createTestHarnessRecord("resources", {
        provider: {
          releaseSession: (_ctx, input) => {
            released.push(input.sessionId);
            return true;
          },
        },
      }),
    ],
    { sessionResources: resources },
  );
  const handle = await createTestApp({ harnessRegistry: registry });
  const project = await handle.deps.projectService.create({ name: "Session retention" });
  const session = await handle.deps.sessionService.create({
    project_id: project.id,
    agent: testHarnessId("resources"),
    title: "Saved conversation",
  });
  const harness = (await registry.get(testHarnessId("resources")))!;
  const run = await harness.start(
    { sessionId: session.id, prompt: "work", events: { push: () => {}, getMessages: () => [] } },
    { projectId: project.id },
  );
  await run.done;
  const first = await openSessionStreamConnection(handle.app);
  const second = await openSessionStreamConnection(handle.app);
  const retain = (connectionId: string) =>
    handle.app.request(`/v1/session-stream/${connectionId}/subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription_id: "tab", retain_session_id: session.id }),
    });
  const advance = async (milliseconds: number) => {
    now += milliseconds;
    expire?.();
    for (let index = 0; index < 20; index++) await Promise.resolve();
  };
  try {
    expect((await retain(first.connectionId)).status).toBe(204);
    expect((await retain(second.connectionId)).status).toBe(204);
    await advance(90 * 60_000);
    expect(released).toEqual([]);
    await first.close();
    await advance(90 * 60_000);
    expect(released).toEqual([]);
    await second.close();
    await advance(0);
    await advance(30 * 60_000 - 1);
    expect(released).toEqual([]);
    await advance(1);
    expect(released).toEqual([session.id]);
  } finally {
    await first.close();
    await second.close();
    await handle.close();
  }
});
