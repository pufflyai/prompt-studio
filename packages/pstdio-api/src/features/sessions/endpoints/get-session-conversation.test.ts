import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { HarnessExit, HarnessSession, SessionMessage } from "pstdio-api-contracts";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

const FAKE_ID = testHarnessId("fake");

// Mirrors the canonical fake harness: pushes a user + assistant message then completes shortly after.
const createFakeHarnessRecord = (): RuntimeHarnessRecord => {
  const sessions = new Map<string, SessionMessage[]>();

  const message = (agentSessionId: string, index: number, role: SessionMessage["role"], text: string) => ({
    id: `${agentSessionId}-msg-${index}`,
    role,
    parts: [{ type: "text" as const, text }],
  });

  const session = (agentSessionId: string): HarnessSession => ({
    agentSessionId,
    done: new Promise<HarnessExit>((resolve) => {
      setTimeout(() => resolve({ status: "completed" }), 50);
    }),
    stop: () => {},
  });

  return createTestHarnessRecord("fake", {
    provider: {
      start: (_ctx, input) => {
        const agentSessionId = `fake-${crypto.randomUUID()}`;
        const messages = [
          message(agentSessionId, 0, "user", input.prompt),
          message(agentSessionId, 1, "assistant", `Fake Agent: completed "${input.prompt}"`),
        ];
        sessions.set(agentSessionId, messages);
        for (const [index, value] of messages.entries()) {
          input.events.push({ op: "add", path: `/messages/${index}`, value });
        }
        return session(agentSessionId);
      },
      resume: (_ctx, input) => {
        const existing = sessions.get(input.agentSessionId) ?? [];
        const startIndex = input.messageOffset ?? existing.length;
        const messages = [
          message(input.agentSessionId, startIndex, "user", input.prompt),
          message(input.agentSessionId, startIndex + 1, "assistant", `Fake Agent: follow-up "${input.prompt}"`),
        ];
        sessions.set(input.agentSessionId, [...existing, ...messages]);
        for (const [offset, value] of messages.entries()) {
          input.events.push({ op: "add", path: `/messages/${startIndex + offset}`, value });
        }
        return session(input.agentSessionId);
      },
      getMessages: (_ctx, input) => sessions.get(input.agentSessionId) ?? [],
    },
  });
};

let app: OpenAPIHono<AppBindings>;
let handle: Awaited<ReturnType<typeof createApp>>;
let tempRoot: string;

const waitForSessionStatus = async (sessionId: string, expectedStatus: string) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const getRes = await app.request(`/v1/sessions/${sessionId}`);
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { status: string };
    if (body.status === expectedStatus) return;
    await Bun.sleep(20);
  }

  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

// Queue entries left pending can still be dispatched by an in-flight capacity drain;
// remove them and let any already-dispatched run settle so exit handling never races shutdown.
const settleQueuedSession = async (sessionId: string) => {
  await handle.deps.sessionQueueEntriesService.removeBySession(sessionId);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const session = await handle.deps.sessionService.get(sessionId);
    if (!handle.deps.sessionService.store.get(sessionId) && session?.status !== "in_progress") return;
    await Bun.sleep(25);
  }
};

const extractTextParts = (messages: unknown[]) => {
  const texts: string[] = [];

  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const parts = (message as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const type = (part as { type?: unknown }).type;
      const text = (part as { text?: unknown }).text;

      if (type === "text" && typeof text === "string") {
        texts.push(text);
      }
    }
  }

  return texts;
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-get-session-conversation-test-"));
  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    harnessRegistry: createTestHarnessRegistry([createFakeHarnessRecord()]),
  });
  app = handle.app;
});

afterAll(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/sessions/:id/conversation", () => {
  test("returns the full conversation payload", async () => {
    const promptA = "first prompt";
    const promptB = "second prompt";

    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Conversation Download Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Conversation Download Session",
        prompt: promptA,
        agent: FAKE_ID,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };

    await waitForSessionStatus(created.id, "completed");

    const followUpRes = await app.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: promptB }),
    });
    expect(followUpRes.status).toBe(200);

    await waitForSessionStatus(created.id, "completed");

    const conversationRes = await app.request(`/v1/sessions/${created.id}/conversation`);
    expect(conversationRes.status).toBe(200);
    const conversation = (await conversationRes.json()) as {
      session: { id: string };
      messages: unknown[];
    };

    expect(conversation.session.id).toBe(created.id);
    expect(conversation.messages.length).toBeGreaterThan(0);

    const textParts = extractTextParts(conversation.messages);
    expect(textParts).toContain(promptA);
    expect(textParts).toContain(promptB);
  });

  test("fetches messages from agent for completed sessions", async () => {
    const prompt = "agent source of truth";

    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Agent Messages Project" }),
    });
    const project = (await projectRes.json()) as { id: string };

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, title: "Agent test", prompt, agent: FAKE_ID }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };

    await waitForSessionStatus(created.id, "completed");

    // Session is now completed and not in sessionStore — conversation
    // endpoint should fetch fresh messages from the agent, not just
    // the persisted file, so it picks up any messages the agent has
    // that were missed during persistence.
    const conversationRes = await app.request(`/v1/sessions/${created.id}/conversation`);
    expect(conversationRes.status).toBe(200);
    const conversation = (await conversationRes.json()) as {
      session: { id: string; agent_session_id: string | null };
      messages: unknown[];
    };

    expect(conversation.session.agent_session_id).not.toBeNull();

    const textParts = extractTextParts(conversation.messages);
    expect(textParts).toContain(prompt);
    expect(textParts).toContain(`Fake Agent: completed "${prompt}"`);
  });

  test("appends the persisted queued start prompt for queued sessions", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Queued Conversation Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    const queued = await handle.deps.sessionService.createQueuedWithEntry(
      {
        project_id: project.id,
        title: "Queued conversation",
        agent: FAKE_ID,
        prompt: "queued start prompt",
        request_kind: "start",
      },
      { emitStartedHook: false },
    );

    const conversationRes = await app.request(`/v1/sessions/${queued.id}/conversation`);
    expect(conversationRes.status).toBe(200);
    const conversation = (await conversationRes.json()) as { messages: unknown[] };

    expect(extractTextParts(conversation.messages)).toEqual(["queued start prompt"]);

    await settleQueuedSession(queued.id);
  });

  test("preserves conversation history before the persisted queued follow-up prompt", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Queued Follow-up Conversation Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Queued follow-up",
        prompt: "original prompt",
        agent: FAKE_ID,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };
    await waitForSessionStatus(created.id, "completed");

    await handle.deps.sessionService.queueExistingWithEntry({
      id: created.id,
      prompt: "queued follow-up prompt",
      request_kind: "follow_up",
    });

    const conversationRes = await app.request(`/v1/sessions/${created.id}/conversation`);
    expect(conversationRes.status).toBe(200);
    const conversation = (await conversationRes.json()) as { messages: unknown[] };

    const textParts = extractTextParts(conversation.messages);
    expect(textParts.indexOf("original prompt")).toBeGreaterThanOrEqual(0);
    expect(textParts.indexOf("queued follow-up prompt")).toBeGreaterThan(textParts.indexOf("original prompt"));

    await settleQueuedSession(created.id);
  });

  test("returns 404 for an unknown session id", async () => {
    const response = await app.request("/v1/sessions/nonexistent/conversation");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Session not found: nonexistent" });
  });
});
