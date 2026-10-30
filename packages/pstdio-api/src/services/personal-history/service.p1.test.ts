import { beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDocumentStorage } from "pstdio-sync";
import { createResourceLinksApi } from "../../features/extensions/command-environment/resource-links";
import { streamPersonalSession } from "../../features/sessions/endpoints/stream-personal-session";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createTestApp } from "../../test-utils/create-test-app";
import { createNativeStore } from "../account/native-store";
import { capturePersonalHistory } from "./capture";
import { createHistoryReferences, historyReferenceName } from "./references";
import { createPersonalHistoryStore } from "./store";

const root = await mkdtemp(join(tmpdir(), "personal-history-"));
const databasePath = join(root, "database");
const storageRoot = join(root, "storage");
let source: Awaited<ReturnType<typeof createTestApp>>;
let destination: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  source = await createTestApp();
});
beforeAll(async () => {
  destination = await createTestApp({ databasePath, storageRoot });
});

const verifyMetadataOwnership = async (
  native: ReturnType<typeof createNativeStore>,
  login: Parameters<ReturnType<typeof createNativeStore>["save"]>[0],
  sessionId: string,
) => {
  const workspaceReads = destination.deps.workspaceSessionService;
  const lookup = workspaceReads.getWorkspaceBySessionId;
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  workspaceReads.getWorkspaceBySessionId = async (id) => {
    started.resolve();
    await released.promise;
    return lookup(id);
  };
  const pending = Promise.resolve(destination.app.request(`/v1/sessions/${sessionId}`));
  const first = await Promise.race([
    pending.then((response) => ({ response })),
    started.promise.then(() => ({ response: null })),
  ]);
  if (!first.response) await native.save({ ...login, accountId: "bob" });
  released.resolve();
  const response = await pending;
  workspaceReads.getWorkspaceBySessionId = lookup;
  expect(response.status).toBe(first.response ? 200 : 404);
  if (first.response)
    expect(await response.json()).toMatchObject({ id: sessionId, device: { ownerId: login.accountId } });
  await native.save(login);
  await destination.deps.personalHistoryService.refreshIdentity();
};

test("personal history is readable offline after restart, private to the account, and never a local execution record", async () => {
  const managerOrigin = "https://127.0.0.1:1";
  const accountId = "alice";
  try {
    const project = await source.deps.projectService.create({ name: "Personal history" });
    await destination.deps.projectService.create({ id: project.id, name: project.name });
    const workspace = await source.deps.workspaceService.createStandalone({
      project_id: project.id,
      name: "Private workspace",
      root_path: "/private/source",
    });
    const session = await source.deps.sessionService.create({
      project_id: project.id,
      title: "Private session",
      status: "completed",
      agent: "unavailable",
    });
    await source.deps.workspaceSessionService.link(workspace.id, session.id);
    const secondWorkspace = await source.deps.workspaceService.createStandalone({
      project_id: project.id,
      name: "Second workspace",
    });
    await source.deps.workspaceSessionService.link(secondWorkspace.id, session.id);
    const active = source.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
    const conversation = await active.conversationReady;
    const messages = [
      {
        id: "message",
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: "Full private conversation" }],
      },
    ];
    conversation.push({ op: "add", path: "/messages/0", value: messages[0] });
    const store = (host: typeof source, owner = accountId) =>
      createPersonalHistoryStore({
        projectId: project.id,
        managerOrigin,
        accountId: owner,
        documents: host.deps.extensionStorageService.documents,
      });
    const refs = (host: typeof source) =>
      createHistoryReferences(host.deps.extensionStorageService.documents.open(historyReferenceName), project.id);
    const history = store(source);
    const device = { ownerId: accountId, id: "source-device", name: "Laptop" };
    await capturePersonalHistory({
      projectId: project.id,
      device,
      history,
      references: refs(source),
      deps: source.deps,
    });
    const sourceLinks = createResourceLinksApi(source.deps, { projectId: project.id });
    await sourceLinks.addAnchors({ type: "session", id: session.id }, [{ type: "project", id: project.id }]);
    expect(
      (await sourceLinks.listAnchors({ resource: { type: "project", id: project.id }, direction: "incoming" })).items[0]
        ?.source.device,
    ).toEqual(device);
    for (const name of ["records", history.transcriptName(session.id)]) {
      const from = createDocumentStorage({
        owner: history.owner,
        store: source.deps.extensionStorageService.documents.open(name),
      });
      const to = createDocumentStorage({
        owner: history.owner,
        store: destination.deps.extensionStorageService.documents.open(name),
      });
      await to.applyUpdate(await from.exportUpdate());
    }
    const sharedFrom = refs(source);
    const sharedTo = refs(destination);
    await createDocumentStorage(sharedTo).applyUpdate(await createDocumentStorage(sharedFrom).exportUpdate());
    await capturePersonalHistory({
      projectId: project.id,
      device: { ...device, ownerId: "bob" },
      history: store(source, "bob"),
      references: refs(source),
      deps: source.deps,
    });
    expect(await store(source, "bob").readRecords("sessions")).toEqual([]);
    expect(await store(source, "bob").readRecords("workspaces")).toEqual([]);
    await source.close();
    const { environmentId } = await destination.deps.environmentService.get();
    const native = createNativeStore(join(root, "native-account.json"));
    const login = {
      managerOrigin,
      relayOrigin: managerOrigin,
      accountId,
      deviceId: environmentId,
      token: "offline-credential",
    };
    await native.save(login);
    await destination.close();
    destination = await createTestApp({ databasePath, storageRoot });
    expect(await destination.deps.sessionService.get(session.id)).toBeNull();
    expect(await destination.deps.workspaceService.get(workspace.id)).toBeNull();
    const read = await destination.app.request(`/v1/sessions/${session.id}/conversation`);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ session: { id: session.id, device }, messages });
    const rows = await destination.app.request(`/v1/projects/${project.id}/sessions?workspaceId=${workspace.id}`);
    expect(rows.status).toBe(200);
    expect(await rows.json()).toMatchObject({ items: [{ id: session.id, device, workspaceId: workspace.id }] });
    const secondRows = await destination.app.request(
      `/v1/projects/${project.id}/sessions?workspaceId=${secondWorkspace.id}`,
    );
    expect(await secondRows.json()).toMatchObject({ items: [{ id: session.id, workspaceId: secondWorkspace.id }] });
    const workspaces = await destination.app.request(`/v1/projects/${project.id}/workspaces`);
    expect(await workspaces.json()).toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ id: workspace.id, device })]),
    });
    const state = await destination.deps.syncService.getFullState();
    expect(state.sessions).toContainEqual(expect.objectContaining({ id: session.id, device }));
    expect(state.workspace_sessions).toHaveLength(2);
    const shared = createResourceLinksApi(destination.deps, { projectId: project.id });
    await shared.addAnchors({ type: "project", id: project.id }, [
      {
        type: "session",
        id: session.id,
        role: "result",
        label: "Private title",
        metadata: { path: "/private/source" },
      },
    ]);
    for (const readAnchors of [shared.queryAnchors, shared.listAnchors]) {
      const page = await readAnchors({ resource: { type: "project", id: project.id } });
      expect(page.items[0]?.target).toEqual({
        type: "session",
        id: session.id,
        projectId: project.id,
        extensionId: "pstdio",
        role: "result",
        device,
      });
    }
    const frames: unknown[] = [];
    await streamPersonalSession(session.id, destination.deps, {
      aborted: false,
      onAbort() {},
      sleep: async () => {},
      write: async (event, data) => {
        frames.push({ event, data });
      },
    });
    expect(frames).toContainEqual({ event: "patch", data: { op: "replace", path: "/messages", value: messages } });
    expect(frames).toContainEqual({ event: "end", data: { status: "completed" } });
    const queue = await destination.app.request(`/v1/sessions/${session.id}/queued-messages`);
    expect(await queue.json()).toMatchObject({ messages: [], queue: { requests: [] } });
    const cancel = await destination.app.request(`/v1/sessions/${session.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(cancel.status).toBe(404);
    await verifyMetadataOwnership(native, login, session.id);
    const since = destination.deps.eventBus.seq;
    await destination.deps.accountService.logout();
    const invalidation = destination.deps.eventBus.getSince(since);
    expect(invalidation).toContainEqual(
      expect.objectContaining({ table: "sessions", op: "delete", data: { id: session.id } }),
    );
    expect(invalidation).toContainEqual(
      expect.objectContaining({
        table: "resource_events",
        data: expect.objectContaining({ resource: expect.objectContaining({ type: "session", id: session.id }) }),
      }),
    );
    await native.save(login);
    const startedRead = Promise.withResolvers<void>();
    const releaseRead = Promise.withResolvers<void>();
    const documents = destination.deps.extensionStorageService.documents;
    const open = documents.open.bind(documents);
    documents.open = (name) => {
      const document = open(name);
      if (name !== history.transcriptName(session.id)) return document;
      return {
        ...document,
        transaction: async (owner, action) => {
          startedRead.resolve();
          await releaseRead.promise;
          return document.transaction(owner, action);
        },
      };
    };
    const pendingRead = destination.app.request(`/v1/sessions/${session.id}/conversation`);
    await startedRead.promise;
    await native.save({ ...login, accountId: "bob" });
    releaseRead.resolve();
    const switched = await pendingRead;
    documents.open = open;
    expect(switched.status).toBe(404);
    expect(await switched.text()).not.toContain("Private session");
    expect((await destination.app.request(`/v1/sessions/${session.id}/conversation`)).status).toBe(404);
    expect(await destination.deps.personalHistoryService.sessions(project.id)).toEqual([]);
    expect(await destination.deps.personalHistoryService.reference(project.id, "session", session.id)).toEqual({
      type: "session",
      id: session.id,
      device,
    });
    await native.forget(login.token);
    expect(await destination.deps.personalHistoryService.sessions(project.id)).toEqual([]);
  } finally {
    await source.close();
    await destination.close();
    await rm(root, { recursive: true, force: true });
  }
});
