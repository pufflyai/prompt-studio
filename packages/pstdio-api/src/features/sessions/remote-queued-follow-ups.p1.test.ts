import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jsonSchema } from "pstdio-sync-contracts";
import { AccountRequestError, nativeAccountFile } from "../../services/account/native-account";
import { createNativeStore } from "../../services/account/native-store";
import { createPersonalHistoryStore } from "../../services/personal-history/store";
import { withDeviceCommandAttachments } from "../../services/relay/device-command-attachments";
import { createDeviceCommandExecutor } from "../../services/relay/device-command-executor";
import { createTestApp } from "../../test-utils/create-test-app";

const remoteQueue = async () => {
  const root = await mkdtemp(join(tmpdir(), "remote-queue-"));
  const source = await createTestApp({ storageRoot: join(root, "source") });
  const target = await createTestApp();
  const project = await target.deps.projectService.create({ name: "Queue" });
  await source.deps.projectService.create({ id: project.id, name: project.name });
  const { environmentId: sourceId } = await source.deps.environmentService.get();
  const { environmentId: targetId } = await target.deps.environmentService.get();
  const login = {
    accountId: "owner",
    deviceId: sourceId,
    token: "fixture",
    managerOrigin: "https://127.0.0.1:1",
    relayOrigin: "https://127.0.0.1:1",
  };
  await createNativeStore(nativeAccountFile(":memory:", join(root, "source"))).save(login);
  await source.deps.personalHistoryService.refreshIdentity();
  const session = await target.deps.sessionService.create({
    project_id: project.id,
    title: "Remote",
    agent: "unavailable",
  });
  const history = createPersonalHistoryStore({
    ...login,
    projectId: project.id,
    documents: source.deps.extensionStorageService.documents,
    index: source.deps.extensionStorageService.personalHistoryIndex,
    logs: source.deps.extensionStorageService.logs,
    files: source.deps.personalHistoryService.logs,
  });
  await history.writeRecords("sessions", { ownerId: login.accountId, id: targetId, name: "Laptop" }, [
    { ...session, workspace_id: null },
  ]);
  const execute = createDeviceCommandExecutor(target.deps, project.id);
  let online = true;
  source.deps.accountService.start(
    async () => {},
    async () => ({ state: "synced", offlineReady: true }),
    async () => {},
    async () => {},
    async (projectId, deviceId, command, signal) => {
      expect([projectId, deviceId]).toEqual([project.id, targetId]);
      if (!online) throw new AccountRequestError("Device offline");
      return withDeviceCommandAttachments(source.deps, projectId, command, (value) =>
        execute(jsonSchema.parse(JSON.parse(JSON.stringify(value))), { signal }),
      );
    },
  );
  const path = `/v1/sessions/${session.id}/queued-follow-ups`;
  const request = (suffix = "", method = "GET", body?: unknown) =>
    source.app.request(`${path}${suffix}`, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return {
    source,
    target,
    project,
    session,
    history,
    targetId,
    execute,
    request,
    offline: () => {
      online = false;
    },
    close: async () => {
      await source.close();
      await target.close();
      await rm(root, { recursive: true, force: true });
    },
  };
};

test("normal remote queue reads and edits retain target ownership and stale revision checks", async () => {
  const fixture = await remoteQueue();
  try {
    const { target, source, session, request } = fixture;
    const queue = target.deps.sessionQueueEntriesService;
    const first = await queue.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "First",
      model: "saved",
    });
    await queue.create({ session_id: session.id, request_kind: "follow_up", prompt: "Second", model: "saved" });
    const read = await request();
    expect(read.status).toBe(200);
    expect((await read.json()).requests.map((item: { prompt: string }) => item.prompt)).toEqual(["First", "Second"]);
    const updated = await request(`/${first.queue_position}`, "PATCH", {
      prompt: "Edited",
      expectedRevision: first.revision,
    });
    expect(updated.status).toBe(200);
    const saved = (await updated.json()).request;
    expect(saved).toMatchObject({ prompt: "Edited", model: "saved" });
    expect(
      (await request(`/${first.queue_position}`, "PATCH", { prompt: "Stale", expectedRevision: first.revision }))
        .status,
    ).toBe(409);
    const moved = await request(`/${first.queue_position}/move`, "POST", {
      direction: "down",
      expectedRevision: saved.revision,
    });
    expect(moved.status).toBe(200);
    const afterMove = await (await request()).json();
    expect(afterMove.requests.map((item: { prompt: string }) => item.prompt)).toEqual(["Second", "Edited"]);
    const [a, b] = afterMove.requests;
    const combined = await request(`/${b.queuePosition}/combine`, "POST", {
      sourcePosition: a.queuePosition,
      sourceRevision: a.revision,
      targetRevision: b.revision,
    });
    expect(combined.status).toBe(200);
    const merged = (await combined.json()).request;
    expect(merged.prompt).toContain("Second");
    expect(merged.prompt).toContain("Edited");
    expect((await request(`/${merged.queuePosition}?expectedRevision=${merged.revision}`, "DELETE")).status).toBe(200);
    expect((await (await request()).json()).requests).toEqual([]);
    expect(await source.deps.sessionService.get(session.id)).toBeNull();
    expect(await target.deps.sessionService.get(session.id)).not.toBeNull();
  } finally {
    await fixture.close();
  }
});

test("remote queue updates keep target-only attachments and import new attachments atomically", async () => {
  const fixture = await remoteQueue();
  try {
    const { source, target, project, session, request } = fixture;
    const upload = async (app: typeof source, name: string) => {
      const response = await app.app.request(`/v1/projects/${project.id}/session-attachments`, {
        method: "POST",
        headers: { "x-file-name": name, "content-type": "text/plain" },
        body: name,
      });
      expect(response.status).toBe(201);
      return (await response.json()).fileId as string;
    };
    const oldFile = await upload(target, "target.txt");
    const newFile = await upload(source, "source.txt");
    const first = await target.deps.sessionQueueEntriesService.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "First",
      attachments_json: [{ file_id: oldFile }],
    });
    const response = await request(`/${first.queue_position}`, "PATCH", {
      prompt: "With files",
      expectedRevision: first.revision,
      attachments: [{ file_id: oldFile }, { file_id: newFile }],
    });
    expect(response.status).toBe(200);
    expect(await target.deps.fileService.get(newFile)).not.toBeNull();
    const unusedFile = await upload(source, "unused.txt");
    expect(
      (
        await request(`/${first.queue_position}`, "PATCH", {
          prompt: "Stale",
          expectedRevision: first.revision,
          attachments: [{ file_id: unusedFile }],
        })
      ).status,
    ).toBe(409);
    expect(await target.deps.fileService.get(unusedFile)).toBeNull();
    expect(await target.deps.fileService.get(oldFile)).not.toBeNull();
    expect(await source.deps.fileService.get(oldFile)).toBeNull();
  } finally {
    await fixture.close();
  }
});

test("offline remote queue reads keep the shared preview and never save failed edits locally", async () => {
  const fixture = await remoteQueue();
  try {
    const { source, target, project, session, history, targetId, request } = fixture;
    const entry = await target.deps.sessionQueueEntriesService.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "Saved on Laptop",
    });
    await history.writeRecords("queues", { ownerId: "owner", id: targetId, name: "Laptop" }, [
      {
        id: session.id,
        requests: [
          { queuePosition: entry.queue_position, revision: entry.revision, prompt: "Saved on Laptop", model: null },
        ],
      },
    ]);
    fixture.offline();
    const queue = await request();
    expect(queue.status).toBe(200);
    expect((await queue.json()).requests).toMatchObject([{ prompt: "Saved on Laptop" }]);
    const messages = await source.app.request(`/v1/sessions/${session.id}/queued-messages`);
    expect(messages.status).toBe(200);
    expect((await messages.json()).messages[0].parts[0]).toEqual({ type: "text", text: "Saved on Laptop" });
    expect(
      (await request(`/${entry.queue_position}`, "PATCH", { prompt: "Do not save", expectedRevision: entry.revision }))
        .status,
    ).toBe(400);
    expect((await target.deps.sessionQueueEntriesService.get(entry.queue_position))?.prompt).toBe("Saved on Laptop");
    expect(await source.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toEqual([]);
    const other = await target.deps.projectService.create({ name: "Other project" });
    expect(
      await fixture.execute(
        jsonSchema.parse({ type: "session.queueDelete", id: session.id, queuePosition: entry.queue_position }),
        { signal: new AbortController().signal },
      ),
    ).toMatchObject({ status: 200 });
    const foreign = await target.deps.sessionService.create({
      project_id: other.id,
      title: "Other",
      agent: "unavailable",
    });
    expect(
      await fixture.execute(jsonSchema.parse({ type: "session.queuedFollowUps", id: foreign.id }), {
        signal: new AbortController().signal,
      }),
    ).toMatchObject({ status: 404 });
    expect(project.id).not.toBe(other.id);
  } finally {
    await fixture.close();
  }
});
