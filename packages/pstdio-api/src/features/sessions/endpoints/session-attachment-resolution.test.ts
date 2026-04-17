import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
const previousAgentsEnv = process.env.PSTDIO_AGENTS;

const png1x1Base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQx3G5wAAAAASUVORK5CYII=";

const createProject = async (name: string) => {
  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(projectRes.status).toBe(201);
  return projectRes.json();
};

const uploadAttachment = async (projectId: string, fileName: string) => {
  const uploadRes = await app.request("/v1/sessions/attachments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      file_name: fileName,
      mime_type: "image/png",
      content_base64: png1x1Base64,
    }),
  });

  expect(uploadRes.status).toBe(201);
  return uploadRes.json();
};

const waitForSessionStatus = async (sessionId: string, expectedStatus: string) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const getRes = await app.request(`/v1/sessions/${sessionId}`);
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    if (body.status === expectedStatus) return body;
    await Bun.sleep(20);
  }

  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-session-attachments-resolution-test-"));
  process.env.PSTDIO_AGENTS = "fake";
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
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

describe("session attachment resolution", () => {
  test("rejects create session when attachment belongs to another project", async () => {
    const projectA = await createProject("Attachment Scope A");
    const projectB = await createProject("Attachment Scope B");
    const attachment = await uploadAttachment(projectB.id, "other-project.png");

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectA.id,
        title: "Cross project attachment",
        prompt: "please use this",
        agent: "fake",
        attachments: [
          {
            id: attachment.id,
            file_name: attachment.file_name,
            mime_type: attachment.mime_type,
            size_bytes: attachment.size_bytes,
          },
        ],
      }),
    });

    expect(createRes.status).toBe(400);
    expect(await createRes.json()).toEqual({ error: `Attachment not found: ${attachment.id}` });
  });

  test("rejects follow-up when attachment binary no longer exists", async () => {
    const project = await createProject("Missing Attachment Binary");

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Follow-up with attachment",
        prompt: "initial",
        agent: "fake",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    await waitForSessionStatus(created.id, "completed");

    const attachment = await uploadAttachment(project.id, "missing.png");
    unlinkSync(join(tempRoot, "storage", project.id, attachment.id));

    const followUpRes = await app.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "follow up with missing attachment",
        attachments: [
          {
            id: attachment.id,
            file_name: attachment.file_name,
            mime_type: attachment.mime_type,
            size_bytes: attachment.size_bytes,
          },
        ],
      }),
    });

    expect(followUpRes.status).toBe(400);
    expect(await followUpRes.json()).toEqual({ error: `Attachment not found: ${attachment.id}` });
  });
});
