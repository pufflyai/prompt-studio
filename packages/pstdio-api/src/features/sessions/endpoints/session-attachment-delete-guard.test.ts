import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import type { HarnessStartInput } from "pstdio-api-contracts";
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

const blockDispatchStartedMarker = (isolated: Awaited<ReturnType<typeof createIsolatedApp>>) => {
  const original = isolated.deps.sessionQueueEntriesService.createDispatchStarted;
  const reached = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();

  isolated.deps.sessionQueueEntriesService.createDispatchStarted = (async (input) => {
    reached.resolve();
    await release.promise;
    return original(input);
  }) as typeof original;

  return {
    release: release.resolve,
    waitUntilReached: reached.promise,
  };
};

describe("session attachment delete guard", () => {
  test("rejects deleting a start attachment while create is submitting refs", async () => {
    const isolated = await createIsolatedApp();
    const marker = blockDispatchStartedMarker(isolated);
    try {
      const project = await createProject(isolated.app, "Create Submit Race Delete Guard Project");
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "create-race.txt",
        content: "create race context",
        type: "text/plain",
      });
      const uploadedFile = await isolated.deps.fileService.get(attachment.file_id);

      const createPromise = isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Create submit race",
          prompt: "Use this while submitting",
          agent: FAKE_ID,
          attachments: [{ file_id: attachment.file_id }],
        }),
      });

      await marker.waitUntilReached;
      const deleteRes = await isolated.app.request(
        `/v1/projects/${project.id}/session-attachments/${attachment.file_id}`,
        { method: "DELETE" },
      );
      expect(deleteRes.status).toBe(409);
      expect(await isolated.deps.fileService.get(attachment.file_id)).not.toBeNull();
      expect(existsSync(uploadedFile!.storage_path)).toBe(true);

      marker.release();
      const createRes = await createPromise;
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string };
      await waitForCompleted(isolated.app, created.id);
    } finally {
      marker.release();
      await isolated.close();
    }
  });

  test("rejects deleting a follow-up attachment while follow-up is submitting refs", async () => {
    const isolated = await createIsolatedApp();
    const marker = blockDispatchStartedMarker(isolated);
    try {
      const project = await createProject(isolated.app, "Follow-up Submit Race Delete Guard Project");
      const session = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Follow-up submit race",
        agent: FAKE_ID,
        cwd: "/tmp",
        status: "completed",
      });
      await isolated.deps.sessionService.update(session.id, { agent_session_id: "agent-follow-up-race" });
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "follow-up-race.txt",
        content: "follow-up race context",
        type: "text/plain",
      });
      const uploadedFile = await isolated.deps.fileService.get(attachment.file_id);

      const followUpPromise = isolated.app.request(`/v1/sessions/${session.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Continue while submitting",
          attachments: [{ file_id: attachment.file_id }],
        }),
      });

      await marker.waitUntilReached;
      const deleteRes = await isolated.app.request(
        `/v1/projects/${project.id}/session-attachments/${attachment.file_id}`,
        { method: "DELETE" },
      );
      expect(deleteRes.status).toBe(409);
      expect(await isolated.deps.fileService.get(attachment.file_id)).not.toBeNull();
      expect(existsSync(uploadedFile!.storage_path)).toBe(true);

      marker.release();
      const followUpRes = await followUpPromise;
      expect(followUpRes.status).toBe(200);
      await waitForCompleted(isolated.app, session.id);
    } finally {
      marker.release();
      await isolated.close();
    }
  });

  test("rejects deleting a direct-dispatched start attachment immediately after create returns", async () => {
    const isolated = await createIsolatedApp({ delayHarnessResolutionAfterGets: 1 });
    try {
      const project = await createProject(isolated.app, "Immediate Create Delete Guard Project");
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "immediate-create.txt",
        content: "create context",
        type: "text/plain",
      });
      const uploadedFile = await isolated.deps.fileService.get(attachment.file_id);

      const createRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Immediate direct attachment",
          prompt: "Use this before startup",
          agent: FAKE_ID,
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(createRes.status).toBe(201);
      expect(isolated.harness.start).not.toHaveBeenCalled();

      const deleteRes = await isolated.app.request(
        `/v1/projects/${project.id}/session-attachments/${attachment.file_id}`,
        { method: "DELETE" },
      );
      expect(deleteRes.status).toBe(409);
      expect(await isolated.deps.fileService.get(attachment.file_id)).not.toBeNull();
      expect(existsSync(uploadedFile!.storage_path)).toBe(true);

      const created = (await createRes.json()) as { id: string };
      isolated.harness.releaseHarnessResolution();
      await waitForCompleted(isolated.app, created.id);
    } finally {
      isolated.harness.releaseHarnessResolution();
      await isolated.close();
    }
  });

  test("rejects deleting a direct-dispatched follow-up attachment immediately after follow-up returns", async () => {
    const isolated = await createIsolatedApp({ delayHarnessResolutionAfterGets: 0 });
    try {
      const project = await createProject(isolated.app, "Immediate Follow-up Delete Guard Project");
      const session = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Follow-up attachment",
        agent: FAKE_ID,
        cwd: "/tmp",
        status: "completed",
      });
      await isolated.deps.sessionService.update(session.id, { agent_session_id: "agent-follow-up" });
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "immediate-follow-up.txt",
        content: "follow-up context",
        type: "text/plain",
      });
      const uploadedFile = await isolated.deps.fileService.get(attachment.file_id);

      const followUpRes = await isolated.app.request(`/v1/sessions/${session.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Continue with this before resume",
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(followUpRes.status).toBe(200);
      expect(isolated.harness.resume).not.toHaveBeenCalled();

      const deleteRes = await isolated.app.request(
        `/v1/projects/${project.id}/session-attachments/${attachment.file_id}`,
        { method: "DELETE" },
      );
      expect(deleteRes.status).toBe(409);
      expect(await isolated.deps.fileService.get(attachment.file_id)).not.toBeNull();
      expect(existsSync(uploadedFile!.storage_path)).toBe(true);

      isolated.harness.releaseHarnessResolution();
      await waitForCompleted(isolated.app, session.id);
    } finally {
      isolated.harness.releaseHarnessResolution();
      await isolated.close();
    }
  });

  test("rejects deleting a direct-dispatched attachment while the session is active", async () => {
    const isolated = await createIsolatedApp({ deferExit: true });
    try {
      const project = await createProject(isolated.app, "Direct Dispatch Delete Guard Project");
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "submitted.txt",
        content: "submitted context",
        type: "text/plain",
      });
      const uploadedFile = await isolated.deps.fileService.get(attachment.file_id);

      const createRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Direct attachment",
          prompt: "Use this now",
          agent: FAKE_ID,
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(createRes.status).toBe(201);

      for (let attempt = 0; attempt < 20 && isolated.harness.start.mock.calls.length === 0; attempt += 1) {
        await Bun.sleep(20);
      }

      const startInput = isolated.harness.start.mock.calls[0]?.[1] as HarnessStartInput;
      expect(startInput.attachments?.[0]?.fileId).toBe(attachment.file_id);

      const deleteRes = await isolated.app.request(
        `/v1/projects/${project.id}/session-attachments/${attachment.file_id}`,
        { method: "DELETE" },
      );
      expect(deleteRes.status).toBe(409);
      expect(await isolated.deps.fileService.get(attachment.file_id)).not.toBeNull();
      expect(existsSync(uploadedFile!.storage_path)).toBe(true);

      isolated.harness.completeAll();
      const created = (await createRes.json()) as { id: string };
      await waitForCompleted(isolated.app, created.id);
    } finally {
      await isolated.close();
    }
  });
});

describe("session attachment delete with stale session files", () => {
  test("deletes an unsubmitted attachment when a persisted session file is missing from disk", async () => {
    const isolated = await createIsolatedApp();
    try {
      const project = await createProject(isolated.app, "Missing Session File Delete Guard Project");
      const attachment = await uploadAttachment(isolated.app, project.id, {
        name: "draft-after-missing-session-file.txt",
        content: "draft after missing session file",
        type: "text/plain",
      });
      const uploadedFile = await isolated.deps.fileService.get(attachment.file_id);
      const staleSessionFile = await isolated.deps.fileService.upload({
        project_id: project.id,
        file_name: "session-messages.json",
        file_kind: "session_messages",
        data: Buffer.from("[]"),
        mime_type: "application/json",
      });

      const session = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Session with missing file",
        agent: FAKE_ID,
        cwd: "/tmp",
        status: "completed",
      });
      await isolated.deps.sessionService.update(session.id, { session_file_id: staleSessionFile.id });
      rmSync(staleSessionFile.storage_path);

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
