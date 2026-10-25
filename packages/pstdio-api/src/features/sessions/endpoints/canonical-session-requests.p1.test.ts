import { expect, test } from "bun:test";
import type { HarnessAttachment } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../../harnesses/test-harness-registry";

const waitForCompletion = async (app: Awaited<ReturnType<typeof createTestApp>>["app"], sessionId: string) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = await (await app.request(`/v1/sessions/${sessionId}`)).json();
    if (state.status === "completed") return;
    await Bun.sleep(50);
  }
  throw new Error("Session did not complete");
};

test("canonical attachment references and follow-up requests reach the session harness", async () => {
  const received = Promise.withResolvers<readonly HarnessAttachment[]>();
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("local", {
      provider: {
        capabilities: () => ["Attachments"],
        start: (_ctx, input) => {
          received.resolve(input.attachments ?? []);
          return { done: Promise.resolve({ status: "completed" as const }), stop: () => {} };
        },
      },
    }),
  ]);
  const { app, close } = await createTestApp({ harnessRegistry: registry });
  const headers = { "content-type": "application/json" };
  try {
    const project = await (
      await app.request("/v1/projects", {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Session request aliases" })),
      })
    ).json();
    const upload = await app.request(`/v1/projects/${project.id}/session-attachments`, {
      method: "POST",
      headers: { "content-type": "text/plain", "x-file-name": "note.txt" },
      body: "A note",
    });
    expect(upload.status).toBe(201);
    const file = await upload.json();
    expect(file).toMatchObject({
      fileId: file.file_id,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      createdAt: file.created_at,
      updatedAt: file.updated_at,
    });
    const created = await app.request("/v1/sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        projectId: project.id,
        title: "Attachment",
        prompt: "Read this",
        attachments: [{ fileId: file.fileId }],
      }),
    });
    expect(created.status).toBe(201);
    expect(await received.promise).toHaveLength(1);
    const session = await created.json();
    await waitForCompletion(app, session.id);
    const follow = await app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: "Continue", summaryFormat: "brief", summaryRole: "assistant" }),
    });
    expect(follow.status).toBe(200);
    const result = await follow.json();
    expect(result.followUp).toEqual(result.follow_up);
    expect(result.projectId).toBe(project.id);
    await waitForCompletion(app, session.id);
  } finally {
    await close();
  }
});

test("queued follow-ups expose canonical queue positions alongside legacy decisions", async () => {
  let sessionId: string | undefined;
  const completion = Promise.withResolvers<{ status: "completed" }>();
  const started = Promise.withResolvers<void>();
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("local", {
      provider: {
        start: () => {
          started.resolve();
          return { done: completion.promise, stop: () => completion.resolve({ status: "completed" }) };
        },
      },
    }),
  ]);
  const { app, close } = await createTestApp({ harnessRegistry: registry });
  const headers = { "content-type": "application/json" };
  try {
    const project = await (
      await app.request("/v1/projects", {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Queued requests" })),
      })
    ).json();
    const session = await (
      await app.request("/v1/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({ projectId: project.id, title: "Held", prompt: "Start" }),
      })
    ).json();
    sessionId = session.id;
    await started.promise;
    const response = await app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: "Continue" }),
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.follow_up.status).toBe("queued");
    expect(result.followUp).toEqual({ status: "queued", queuePosition: result.follow_up.queue_position });
  } finally {
    completion.resolve({ status: "completed" });
    if (sessionId) await waitForCompletion(app, sessionId);
    await close();
  }
});
