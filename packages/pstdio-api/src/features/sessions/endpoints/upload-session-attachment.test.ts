import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
const png1x1Base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQx3G5wAAAAASUVORK5CYII=";

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-session-attachment-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("session attachment endpoints", () => {
  test("uploads image attachments and serves binary content", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Attachment Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const uploadRes = await app.request("/v1/sessions/attachments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        file_name: "image.png",
        mime_type: "image/png",
        content_base64: png1x1Base64,
      }),
    });

    expect(uploadRes.status).toBe(201);
    const uploaded = await uploadRes.json();
    expect(uploaded.file_name).toBe("image.png");
    expect(uploaded.mime_type).toBe("image/png");

    const contentRes = await app.request(`/v1/sessions/attachments/${uploaded.id}/content?project_id=${project.id}`);
    expect(contentRes.status).toBe(200);
    expect(contentRes.headers.get("content-type")).toBe("image/png");
    expect((await contentRes.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  test("rejects non-image mime types", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Invalid Attachment Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const uploadRes = await app.request("/v1/sessions/attachments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        file_name: "notes.txt",
        mime_type: "text/plain",
        content_base64: Buffer.from("hello", "utf8").toString("base64"),
      }),
    });

    expect(uploadRes.status).toBe(400);
  });

  test("rejects malformed base64 payload", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Malformed Base64 Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const uploadRes = await app.request("/v1/sessions/attachments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        file_name: "image.png",
        mime_type: "image/png",
        content_base64: "%%%not-base64%%%",
      }),
    });

    expect(uploadRes.status).toBe(400);
    expect(await uploadRes.json()).toEqual({ error: "Invalid base64 image payload." });
  });

  test("returns 404 when attachment binary is missing from disk", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Missing Attachment File Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const uploadRes = await app.request("/v1/sessions/attachments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        file_name: "image.png",
        mime_type: "image/png",
        content_base64: png1x1Base64,
      }),
    });
    expect(uploadRes.status).toBe(201);

    const uploaded = await uploadRes.json();
    unlinkSync(join(tempRoot, "storage", project.id, uploaded.id));

    const contentRes = await app.request(`/v1/sessions/attachments/${uploaded.id}/content?project_id=${project.id}`);
    expect(contentRes.status).toBe(404);
  });

  test("rejects payload when declared mime type does not match image bytes", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Mime Mismatch Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const uploadRes = await app.request("/v1/sessions/attachments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        file_name: "fake.png",
        mime_type: "image/png",
        content_base64: Buffer.from("plain text", "utf8").toString("base64"),
      }),
    });

    expect(uploadRes.status).toBe(400);
    expect(await uploadRes.json()).toEqual({ error: "Image bytes do not match declared MIME type." });
  });

  test("returns 404 when project scope does not match attachment owner", async () => {
    const projectARes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Project A" }),
    });
    const projectBRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Project B" }),
    });
    expect(projectARes.status).toBe(201);
    expect(projectBRes.status).toBe(201);
    const projectA = await projectARes.json();
    const projectB = await projectBRes.json();

    const uploadRes = await app.request("/v1/sessions/attachments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectA.id,
        file_name: "scoped.png",
        mime_type: "image/png",
        content_base64: png1x1Base64,
      }),
    });
    expect(uploadRes.status).toBe(201);
    const uploaded = await uploadRes.json();

    const contentRes = await app.request(`/v1/sessions/attachments/${uploaded.id}/content?project_id=${projectB.id}`);
    expect(contentRes.status).toBe(404);
  });
});
