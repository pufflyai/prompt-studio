import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessResumeInput, HarnessStartInput, SessionMessage } from "pstdio-api-contracts";
import {
  cleanupSessionAttachmentTestRoots,
  createIsolatedApp,
  createProject,
  FAKE_ID,
  uploadAttachment,
  waitForCompleted,
} from "./session-attachments.test-utils";

afterAll(() => {
  cleanupSessionAttachmentTestRoots();
});

describe("session attachments", () => {
  test("uploads a project attachment and passes materialized metadata to the harness", async () => {
    const isolated = await createIsolatedApp();
    try {
      const project = await createProject(isolated.app, "Attached Session Project");
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "notes.txt",
        content: "important context",
        type: "text/plain",
      });

      const createRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Attached start",
          prompt: "Use the attachment",
          agent: FAKE_ID,
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string };
      await waitForCompleted(isolated.app, created.id);

      const startInput = isolated.harness.start.mock.calls[0]?.[1] as HarnessStartInput;
      expect(startInput.attachments).toHaveLength(1);
      expect(startInput.attachments?.[0]).toMatchObject({
        fileId: attachment.file_id,
        fileName: "notes.txt",
        mimeType: "text/plain",
        sizeBytes: "important context".length,
      });
      expect(readFileSync(startInput.attachments![0]!.localPath, "utf8")).toBe("important context");

      const conversationRes = await isolated.app.request(`/v1/sessions/${created.id}/conversation`);
      expect(conversationRes.status).toBe(200);
      const conversation = (await conversationRes.json()) as { messages: SessionMessage[] };
      expect(conversation.messages[0]?.parts).toContainEqual(
        expect.objectContaining({ type: "file", fileId: attachment.file_id, filename: "notes.txt" }),
      );
    } finally {
      await isolated.close();
    }
  });

  test("accepts supported attachment types and rejects unsupported uploads", async () => {
    const isolated = await createIsolatedApp();
    try {
      const project = await createProject(isolated.app, "Supported Attachment Upload Project");
      const codeAttachment = await uploadAttachment(isolated.app, project.id, {
        name: "session-context.ts",
        content: "export const value = 1;",
        type: "application/octet-stream",
      });

      expect(codeAttachment.name).toBe("session-context.ts");
      const workbookAttachment = await uploadAttachment(isolated.app, project.id, {
        name: "planning.xlsx",
        content: "accepted workbook",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      expect(workbookAttachment.name).toBe("planning.xlsx");

      const archiveRes = await isolated.app.request(`/v1/projects/${project.id}/session-attachments`, {
        method: "POST",
        headers: {
          "content-type": "application/zip",
          "x-file-name": encodeURIComponent("archive.zip"),
        },
        body: "not supported",
      });

      expect(archiveRes.status).toBe(415);
      expect(await archiveRes.json()).toEqual({
        error:
          "Session attachment type is not supported. Supported uploads: PDF, CSV, XLSX, TXT, Markdown, PNG, SVG, and code files.",
      });
    } finally {
      await isolated.close();
    }
  });

  test("keeps persisted file parts when the provider transcript has only text", async () => {
    const isolated = await createIsolatedApp({ transcriptDropsAttachments: true });
    try {
      const project = await createProject(isolated.app, "Transcript Attachment Project");
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "transcript-notes.txt",
        content: "refresh context",
        type: "text/plain",
      });

      const createRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Transcript refresh",
          prompt: "Use the durable attachment",
          agent: FAKE_ID,
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string };
      await waitForCompleted(isolated.app, created.id);

      const conversationRes = await isolated.app.request(`/v1/sessions/${created.id}/conversation`);
      expect(conversationRes.status).toBe(200);
      const conversation = (await conversationRes.json()) as { messages: SessionMessage[] };
      expect(conversation.messages[0]?.parts).toContainEqual({
        type: "text",
        text: "Use the durable attachment",
      });
      expect(conversation.messages[0]?.parts).toContainEqual(
        expect.objectContaining({ type: "file", fileId: attachment.file_id, filename: "transcript-notes.txt" }),
      );
      expect(conversation.messages[0]?.parts).not.toContainEqual(
        expect.objectContaining({ type: "text", text: expect.stringContaining("<session-attachments>") }),
      );
    } finally {
      await isolated.close();
    }
  });

  test("rejects attachment refs outside the current project", async () => {
    const isolated = await createIsolatedApp();
    try {
      const firstProject = await createProject(isolated.app, "Attachment Owner");
      const secondProject = await createProject(isolated.app, "Attachment Consumer");
      const attachment = await uploadAttachment(isolated.app, firstProject.id, {
        name: "private.txt",
        content: "do not cross project boundaries",
        type: "text/plain",
      });

      const createRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: secondProject.id,
          title: "Invalid attachment",
          prompt: "Try attachment",
          agent: FAKE_ID,
          attachments: [{ file_id: attachment.file_id }],
        }),
      });

      expect(createRes.status).toBe(400);
      expect(await createRes.json()).toEqual({ error: `Session attachment not found: ${attachment.file_id}` });
      expect(isolated.harness.start).not.toHaveBeenCalled();
    } finally {
      await isolated.close();
    }
  });

  test("rejects project files that were not uploaded as session attachments", async () => {
    const isolated = await createIsolatedApp();
    try {
      const project = await createProject(isolated.app, "Attachment Kind Project");
      const file = await isolated.deps.fileService.upload({
        project_id: project.id,
        file_name: "other-kind.txt",
        file_kind: "extension",
        data: Buffer.from("not a session attachment"),
        mime_type: "text/plain",
      });

      const createRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Wrong attachment kind",
          prompt: "Try attachment",
          agent: FAKE_ID,
          attachments: [{ file_id: file.id }],
        }),
      });

      expect(createRes.status).toBe(400);
      expect(await createRes.json()).toEqual({ error: `Session attachment not found: ${file.id}` });
      expect(isolated.harness.start).not.toHaveBeenCalled();
    } finally {
      await isolated.close();
    }
  });
});

describe("queued session attachments", () => {
  test("preserves queued follow-up attachments until dispatch", async () => {
    const isolated = await createIsolatedApp();
    try {
      const project = await createProject(isolated.app, "Queued Attachment Project");
      const active = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Active session",
        agent: FAKE_ID,
        cwd: join(tmpdir(), "queued-session-attachments"),
      });
      await isolated.deps.sessionService.update(active.id, { agent_session_id: "agent-active" });

      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "queued.txt",
        content: "queued context",
        type: "text/plain",
      });

      const followUpRes = await isolated.app.request(`/v1/sessions/${active.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Continue with attachment",
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(followUpRes.status).toBe(200);

      const [queued] = await isolated.deps.sessionQueueEntriesService.listPendingBySession(active.id);
      expect(queued?.attachments_json).toEqual([{ file_id: attachment.file_id }]);

      await isolated.deps.sessionService.transitionStatus(active.id, "completed");
      for (let attempt = 0; attempt < 20 && isolated.harness.resume.mock.calls.length === 0; attempt += 1) {
        await Bun.sleep(20);
      }

      const resumeInput = isolated.harness.resume.mock.calls[0]?.[1] as HarnessResumeInput;
      expect(resumeInput.attachments?.[0]).toMatchObject({
        fileId: attachment.file_id,
        fileName: "queued.txt",
      });
      expect(await isolated.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toEqual([]);
    } finally {
      await isolated.close();
    }
  });

  test("shows pending active follow-up attachments after conversation refresh", async () => {
    const isolated = await createIsolatedApp();
    try {
      const project = await createProject(isolated.app, "Active Pending Attachment Project");
      const active = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Active pending session",
        agent: FAKE_ID,
        cwd: join(tmpdir(), "active-pending-session-attachments"),
      });
      await isolated.deps.sessionService.update(active.id, { agent_session_id: "agent-active" });

      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "active-pending.txt",
        content: "active pending context",
        type: "text/plain",
      });

      const followUpRes = await isolated.app.request(`/v1/sessions/${active.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Queue while active",
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(followUpRes.status).toBe(200);

      const conversationRes = await isolated.app.request(`/v1/sessions/${active.id}/conversation`);
      expect(conversationRes.status).toBe(200);
      const conversation = (await conversationRes.json()) as { messages: SessionMessage[] };
      expect(conversation.messages.at(-1)?.parts).toContainEqual({ type: "text", text: "Queue while active" });
      expect(conversation.messages.at(-1)?.parts).toContainEqual(
        expect.objectContaining({ type: "file", fileId: attachment.file_id, filename: "active-pending.txt" }),
      );
    } finally {
      await isolated.close();
    }
  });

  test("deletes unsubmitted draft attachments", async () => {
    const isolated = await createIsolatedApp();
    try {
      const project = await createProject(isolated.app, "Draft Delete Attachment Project");
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "draft.txt",
        content: "draft only",
        type: "text/plain",
      });
      const uploadedFile = await isolated.deps.fileService.get(attachment.file_id);
      expect(uploadedFile).not.toBeNull();
      expect(existsSync(uploadedFile!.storage_path)).toBe(true);

      const deleteRes = await isolated.app.request(
        `/v1/projects/${project.id}/session-attachments/${attachment.file_id}`,
        {
          method: "DELETE",
        },
      );
      expect(deleteRes.status).toBe(204);
      expect(await isolated.deps.fileService.get(attachment.file_id)).toBeNull();
      expect(existsSync(uploadedFile!.storage_path)).toBe(false);

      const contentRes = await isolated.app.request(
        `/v1/projects/${project.id}/session-attachments/${attachment.file_id}/content`,
      );
      expect(contentRes.status).toBe(404);
    } finally {
      await isolated.close();
    }
  });
});
