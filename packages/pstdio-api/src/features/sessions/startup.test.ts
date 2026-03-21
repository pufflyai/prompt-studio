import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createFakeAgent } from "pstdio-agents";
import { createApp } from "../../app";
import type { AppBindings } from "../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

const waitForSessionStatus = async (sessionId: string, expectedStatus: string) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const res = await app.request(`/v1/sessions/${sessionId}`);
    const body = await res.json();
    if (body.status === expectedStatus) return body;
    await Bun.sleep(50);
  }
  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-startup-test-"));
  const fakeAgent = createFakeAgent();

  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    agents: [fakeAgent],
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("resolveOrphanedSessions (via createApp startup)", () => {
  test("stream sends raw DB status without lazy fix", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Startup Sweep Project" }),
    });
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Will become stale",
        prompt: "hello",
        agent: "fake",
      }),
    });
    const session = await createRes.json();
    await waitForSessionStatus(session.id, "completed");

    // Force back to in_progress (simulates server restart losing the process handle)
    await app.request(`/v1/sessions/${session.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });

    // Without the lazy fix, the stream sends the raw DB status
    const streamRes = await app.request(`/v1/sessions/${session.id}/stream`);
    const body = await streamRes.text();
    expect(body).toContain('"status":"in_progress"');
  });

  test("completed sessions are not affected", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Completed Session Project" }),
    });
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Already completed",
        prompt: "hello",
        agent: "fake",
      }),
    });
    const session = await createRes.json();
    await waitForSessionStatus(session.id, "completed");

    const res = await app.request(`/v1/sessions/${session.id}`);
    expect((await res.json()).status).toBe("completed");
  });
});
