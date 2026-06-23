import { afterAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  cleanupSessionAttachmentTestRoots,
  createIsolatedApp,
  createProject,
  FAKE_ID,
  uploadAttachment,
  waitForSessionStatus,
} from "./session-attachments.test-utils";

afterAll(() => {
  cleanupSessionAttachmentTestRoots();
});

describe("session attachment failure cleanup", () => {
  test("allows deleting a start attachment after harness startup fails before messages persist", async () => {
    const isolated = await createIsolatedApp({ startThrows: true });
    try {
      const project = await createProject(isolated.app, "Start Failure Attachment Cleanup Project");
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "start-failure.txt",
        content: "start failure context",
        type: "text/plain",
      });
      const uploadedFile = await isolated.deps.fileService.get(attachment.file_id);

      const createRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Start failure attachment",
          prompt: "This startup will fail",
          agent: FAKE_ID,
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string };

      await waitForSessionStatus(isolated.app, created.id, "failed");
      expect(await isolated.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);

      const deleteRes = await isolated.app.request(
        `/v1/projects/${project.id}/session-attachments/${attachment.file_id}`,
        { method: "DELETE" },
      );
      expect(deleteRes.status).toBe(204);
      expect(await isolated.deps.fileService.get(attachment.file_id)).toBeNull();
      expect(existsSync(uploadedFile!.storage_path)).toBe(false);
    } finally {
      await isolated.close();
    }
  });

  test("allows deleting a start attachment after message persistence fails on session exit", async () => {
    const isolated = await createIsolatedApp();
    try {
      const project = await createProject(isolated.app, "Persist Failure Attachment Cleanup Project");
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "persist-failure.txt",
        content: "persist failure context",
        type: "text/plain",
      });
      const uploadedFile = await isolated.deps.fileService.get(attachment.file_id);

      // Force message persistence to fail on exit so the dispatch-started guard entry
      // must be released by the exit cleanup rather than by the persist handoff.
      const originalUpload = isolated.deps.fileService.upload;
      isolated.deps.fileService.upload = (async () => {
        throw new Error("persist failed");
      }) as typeof originalUpload;

      const createRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Persist failure attachment",
          prompt: "This persist will fail",
          agent: FAKE_ID,
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string };

      await waitForSessionStatus(isolated.app, created.id, "completed");
      isolated.deps.fileService.upload = originalUpload;
      expect(await isolated.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);

      const deleteRes = await isolated.app.request(
        `/v1/projects/${project.id}/session-attachments/${attachment.file_id}`,
        { method: "DELETE" },
      );
      expect(deleteRes.status).toBe(204);
      expect(await isolated.deps.fileService.get(attachment.file_id)).toBeNull();
      expect(existsSync(uploadedFile!.storage_path)).toBe(false);
    } finally {
      await isolated.close();
    }
  });

  test("allows deleting a follow-up attachment after harness resume fails before messages persist", async () => {
    const isolated = await createIsolatedApp({ resumeThrows: true });
    try {
      const project = await createProject(isolated.app, "Resume Failure Attachment Cleanup Project");
      const session = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Resume failure attachment",
        agent: FAKE_ID,
        cwd: "/tmp",
        status: "completed",
      });
      await isolated.deps.sessionService.update(session.id, { agent_session_id: "agent-resume-failure" });
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "resume-failure.txt",
        content: "resume failure context",
        type: "text/plain",
      });
      const uploadedFile = await isolated.deps.fileService.get(attachment.file_id);

      const followUpRes = await isolated.app.request(`/v1/sessions/${session.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "This resume will fail",
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(followUpRes.status).toBe(200);

      await waitForSessionStatus(isolated.app, session.id, "failed");
      expect(await isolated.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);

      const deleteRes = await isolated.app.request(
        `/v1/projects/${project.id}/session-attachments/${attachment.file_id}`,
        { method: "DELETE" },
      );
      expect(deleteRes.status).toBe(204);
      expect(await isolated.deps.fileService.get(attachment.file_id)).toBeNull();
      expect(existsSync(uploadedFile!.storage_path)).toBe(false);
    } finally {
      await isolated.close();
    }
  });
});
