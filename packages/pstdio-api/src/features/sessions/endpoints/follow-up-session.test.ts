import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createOpencodeAgent } from "pstdio-agents";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

type MockMessage = { role: string; content: { type: string; text: string }[] };

const sessionMessages: Record<string, MockMessage[]> = {};

const mockFetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? "GET";

  // Create session
  if (method === "POST" && url.includes("/session?")) {
    const id = `oc-${crypto.randomUUID().slice(0, 8)}`;
    sessionMessages[id] = [];
    return new Response(JSON.stringify({ id }));
  }

  // POST message
  const postMatch = method === "POST" && url.match(/\/session\/([^/]+)\/message/);
  if (postMatch) {
    const id = postMatch[1];
    const body = JSON.parse(init?.body as string);
    const userText = body.parts?.[0]?.text ?? "";
    sessionMessages[id] = sessionMessages[id] ?? [];
    sessionMessages[id].push(
      { role: "user", content: [{ type: "text", text: userText }] },
      { role: "assistant", content: [{ type: "text", text: `OpenCode: ${userText}` }] },
    );
    return new Response(JSON.stringify({ info: {}, parts: [] }));
  }

  // GET messages
  const getMatch = method === "GET" && url.match(/\/session\/([^/]+)\/message/);
  if (getMatch) {
    return new Response(JSON.stringify(sessionMessages[getMatch[1]] ?? []));
  }

  return new Response("{}", { status: 404 });
};

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

const waitForSessionStatus = async (sessionId: string, expectedStatus: string) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const res = await app.request(`/v1/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    if (body.status === expectedStatus) return body;
    await Bun.sleep(50);
  }
  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-followup-test-"));

  const opencodeAgent = createOpencodeAgent(
    { isCommandAvailable: () => true, getModelsOutput: () => "" },
    {
      startServer: async () => "http://localhost:4096",
      serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
      pingServer: async () => true,
      isPortOpen: async () => true,
      fetcher: mockFetcher,
    },
  );

  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    agents: [opencodeAgent],
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/sessions/:id/follow-up (opencode)", () => {
  test("follow-up transitions through in_progress and completes with new messages", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "OpenCode Follow-up Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    // Create initial session
    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "OpenCode session",
        prompt: "first prompt",
        agent: "opencode",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const completedSession = await waitForSessionStatus(created.id, "completed");
    expect(completedSession.agent_session_id).not.toBeNull();

    // Send follow-up
    const followUpRes = await app.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "second prompt" }),
    });
    expect(followUpRes.status).toBe(200);
    const followUpBody = await followUpRes.json();
    expect(followUpBody.status).toBe("in_progress");

    // Wait for completion
    await waitForSessionStatus(created.id, "completed");

    // Stream replayed messages and verify both prompts are present
    const streamRes = await app.request(`/v1/sessions/${created.id}/stream`);
    expect(streamRes.status).toBe(200);
    const body = await streamRes.text();

    expect(body).toContain("first prompt");
    expect(body).toContain("second prompt");
    expect(body).toContain("OpenCode: first prompt");
    expect(body).toContain("OpenCode: second prompt");
  });

  test("follow-up marks session as failed when opencode server returns an error", async () => {
    const failFetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      // Create session succeeds
      if (method === "POST" && url.includes("/session?")) {
        const id = `oc-fail-${crypto.randomUUID().slice(0, 8)}`;
        return new Response(JSON.stringify({ id }));
      }

      // First POST message succeeds, follow-up fails
      const postMatch = method === "POST" && url.match(/\/session\/([^/]+)\/message/);
      if (postMatch) {
        const id = postMatch[1];
        if (!sessionMessages[id]) {
          sessionMessages[id] = [
            { role: "user", content: [{ type: "text", text: "initial" }] },
            { role: "assistant", content: [{ type: "text", text: "response" }] },
          ];
          return new Response(JSON.stringify({ info: {}, parts: [] }));
        }
        return new Response("Internal Server Error", { status: 500 });
      }

      // GET messages
      const getMatch = method === "GET" && url.match(/\/session\/([^/]+)\/message/);
      if (getMatch) {
        return new Response(JSON.stringify(sessionMessages[getMatch[1]] ?? []));
      }

      return new Response("{}", { status: 404 });
    };

    const failAgent = createOpencodeAgent(
      { isCommandAvailable: () => true, getModelsOutput: () => "" },
      {
        startServer: async () => "http://localhost:4096",
        serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
        pingServer: async () => true,
        isPortOpen: async () => true,
        fetcher: failFetcher,
      },
    );

    const failTempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-followup-fail-"));
    const { app: failApp } = await createApp({
      dbPath: ":memory:",
      storagePath: join(failTempRoot, "storage"),
      filesRoot: "",
      agents: [failAgent],
    });

    const projectRes = await failApp.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Fail Project" }),
    });
    const project = await projectRes.json();

    const createRes = await failApp.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Will fail on follow-up",
        prompt: "initial prompt",
        agent: "opencode",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Wait for initial session to complete
    const waitForStatus = async (sessionId: string, status: string) => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const res = await failApp.request(`/v1/sessions/${sessionId}`);
        const body = await res.json();
        if (body.status === status) return body;
        await Bun.sleep(50);
      }
      throw new Error(`Session ${sessionId} did not reach ${status}`);
    };

    await waitForStatus(created.id, "completed");

    // Send follow-up that will fail
    const followUpRes = await failApp.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "this will fail" }),
    });
    expect(followUpRes.status).toBe(200);

    // Session should transition to failed
    const failedSession = await waitForStatus(created.id, "failed");
    expect(failedSession.status).toBe("failed");

    rmSync(failTempRoot, { recursive: true, force: true });
  });
});
