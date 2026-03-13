import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
const previousAgentsEnv = process.env.PSTDIO_AGENTS;

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
  process.env.PSTDIO_AGENTS = "fake";
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));
});

afterAll(() => {
  if (previousAgentsEnv === undefined) {
    delete process.env.PSTDIO_AGENTS;
  } else {
    process.env.PSTDIO_AGENTS = previousAgentsEnv;
  }
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
        agent: "fake",
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

  test("returns 404 for an unknown session id", async () => {
    const response = await app.request("/v1/sessions/nonexistent/conversation");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Session not found: nonexistent" });
  });
});
