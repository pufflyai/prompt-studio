import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import {
  cleanupSessionAttachmentTestRoots,
  createProject,
  uploadAttachment,
  waitForCompleted,
} from "./session-attachments.test-utils";

const REMOTE_ID = testHarnessId("remote");

let handle: Awaited<ReturnType<typeof createTestApp>>;
const start = mock(() => ({ done: Promise.resolve({ status: "completed" as const }), stop: () => {} }));
const resume = mock(() => ({ done: Promise.resolve({ status: "completed" as const }), stop: () => {} }));

beforeEach(async () => {
  start.mockClear();
  resume.mockClear();
  handle = await createTestApp({
    databasePath: ":memory:",
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("remote", {
        provider: { capabilities: () => ["SessionReattach"], start, resume },
      }),
    ]),
  });
});

afterEach(async () => {
  await handle.close();
});

afterAll(() => {
  cleanupSessionAttachmentTestRoots();
});

describe("harness attachment support", () => {
  test("rejects attachments when creating a session on a harness without the Attachments capability", async () => {
    const project = await createProject(handle.app, "Remote attachments");
    const attachment = await uploadAttachment(handle.app, project.id, {
      name: "notes.txt",
      content: "context",
      type: "text/plain",
    });

    const response = await handle.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Remote start",
        prompt: "Read the file",
        agent: REMOTE_ID,
        attachments: [{ file_id: attachment.file_id }],
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "remote does not accept attachments." });
    expect(start).not.toHaveBeenCalled();
  });

  test("rejects attachments in a follow-up to a harness without the Attachments capability", async () => {
    const project = await createProject(handle.app, "Remote follow-up attachments");
    const created = await handle.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, title: "Remote", prompt: "Hello", agent: REMOTE_ID }),
    });
    const session = (await created.json()) as { id: string };
    await waitForCompleted(handle.app, session.id);
    const attachment = await uploadAttachment(handle.app, project.id, {
      name: "notes.txt",
      content: "context",
      type: "text/plain",
    });

    const response = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Read the file", attachments: [{ file_id: attachment.file_id }] }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "remote does not accept attachments." });
    expect(resume).not.toHaveBeenCalled();
  });
});
