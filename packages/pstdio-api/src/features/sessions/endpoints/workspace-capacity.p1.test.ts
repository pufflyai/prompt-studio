import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

for (const release of ["completion", "unlimited"] as const) {
  test(`device workspace capacity counts distinct workspaces and drains in order after ${release}`, async () => {
    const starts: string[] = [];
    const app = await createTestApp({
      harnessRegistry: createTestHarnessRegistry([
        createTestHarnessRecord("fake", {
          provider: {
            start: (_ctx, input) => {
              starts.push(input.prompt);
              return { agentSessionId: crypto.randomUUID(), done: new Promise(() => {}), stop: () => {} };
            },
            getMessages: () => [],
          },
        }),
      ]),
    });
    const request = async (path: string, body?: unknown, method = "POST") => {
      const response = await app.app.request(`/v1/${path}`, {
        method: body === undefined ? "GET" : method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      expect(response.ok).toBe(true);
      return response.json();
    };
    try {
      expect(await request("workspaces/capacity")).toMatchObject({ activeCount: 0, limit: null });
      const settingsBefore = (await app.deps.syncService.getFullState()).settings;
      await request("workspaces/capacity", { limit: 1 }, "PATCH");
      expect((await app.deps.syncService.getFullState()).settings).toEqual(settingsBefore);
      const projects = [];
      for (const name of ["First", "Second", "Third"])
        projects.push(await request("projects", folderProjectInput({ name })));
      const start = (project: { id: string }, prompt: string) =>
        request("sessions", {
          project_id: project.id,
          title: prompt,
          prompt,
          agent: testHarnessId("fake"),
        });
      const first = await start(projects[0], "first");
      const same = await start(projects[0], "same workspace");
      expect(same.status).toBe("in_progress");
      const second = await start(projects[1], "second");
      const third = await start(projects[2], "third");
      expect([second.status, third.status]).toEqual(["queued", "queued"]);
      expect(await request("workspaces/capacity")).toMatchObject({ activeCount: 1, limit: 1 });
      if (release === "completion") {
        await app.deps.sessionService.transitionStatus(first.id, "completed");
        expect((await app.deps.sessionService.get(second.id))?.status).toBe("queued");
        await app.deps.sessionService.transitionStatus(same.id, "completed");
        expect((await app.deps.sessionService.get(second.id))?.status).toBe("in_progress");
        expect((await app.deps.sessionService.get(third.id))?.status).toBe("queued");
        expect(await request("workspaces/capacity")).toMatchObject({ activeCount: 1, limit: 1 });
        await app.deps.sessionService.transitionStatus(second.id, "completed");
      } else {
        await request("workspaces/capacity", { limit: null }, "PATCH");
      }
      expect((await app.deps.sessionService.get(third.id))?.status).toBe("in_progress");
      expect(starts).toEqual(["first", "same workspace", "second", "third"]);
      expect(await request("workspaces/capacity")).toMatchObject({ activeCount: release === "completion" ? 1 : 3 });
    } finally {
      await app.close();
    }
  });
}

test("SDK capacity and extension follow-ups use the same device limit", async () => {
  const { createClient } = await import("@pstdio/sdk/client");
  const { createWorkspacesApi } = await import("../../extensions/command-environment/workspaces");
  const { createSessionsApi } = await import("../../extensions/command-environment/sessions");
  const harness = createTestHarnessRecord("capacity", {
    provider: {
      start: () => ({ agentSessionId: crypto.randomUUID(), done: new Promise(() => {}), stop: () => {} }),
      getMessages: () => [],
    },
  });
  const app = await createTestApp({ harnessRegistry: createTestHarnessRegistry([harness]) });
  const client = createClient({
    baseUrl: "http://localhost",
    fetch: ((url, init) => app.app.request(String(url), init)) as typeof fetch,
  });
  try {
    const makeProject = async (name: string) => {
      const response = await app.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name })),
      });
      expect(response.status).toBe(201);
      return response.json();
    };
    const first = await makeProject("Capacity holder");
    const second = await makeProject("Queued follow-up");
    const workspaces = createWorkspacesApi(app.deps, { projectId: first.id }, {} as never);
    await workspaces.updateCapacity({ limit: 1 });
    expect(await client.workspaces.getCapacity()).toEqual(await workspaces.getCapacity());
    const sessions = (projectId: string) =>
      createSessionsApi(app.deps, { projectId, project: { id: projectId, name: "Test", shorthand: "T" } });
    const holder = await sessions(first.id).create({
      title: "Run",
      prompt: "hold",
      harness: { harnessId: harness.id },
    });
    const idle = await sessions(second.id).create({ title: "Idle", harness: { harnessId: harness.id } });
    expect(idle.status).toBe("completed");
    await sessions(second.id).followup({ sessionId: idle.id, prompt: "wait" });
    expect((await sessions(second.id).get(idle.id))?.status).toBe("queued");
    expect(await client.workspaces.getCapacity()).toMatchObject({ activeCount: 1, limit: 1 });
    await client.workspaces.updateCapacity({ limit: null });
    expect((await sessions(second.id).get(idle.id))?.status).toBe("in_progress");
    expect(await workspaces.getCapacity()).toMatchObject({ activeCount: 2, limit: null });
    await app.deps.sessionService.transitionStatus(holder.id, "completed");
    expect(await workspaces.getCapacity()).toMatchObject({ activeCount: 1 });
  } finally {
    await app.close();
  }
});
