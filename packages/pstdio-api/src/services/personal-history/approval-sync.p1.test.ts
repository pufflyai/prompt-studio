import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { streamPersonalSession } from "../../features/sessions/endpoints/stream-personal-session";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createTestApp } from "../../test-utils/create-test-app";
import { nativeAccountFile } from "../account/native-account";
import { createNativeStore } from "../account/native-store";
import { watchPersonalHistory } from "../relay/personal-watches";
import { capturePersonalHistory, captureSessionChanges } from "./capture";
import { logRelayFixture } from "./log-transport.fixture";
import { createHistoryReferences, historyReferenceName } from "./references";
import { createPersonalHistoryStore } from "./store";

test("personal session followers receive pending approvals and their resolution without acquiring execution ownership", async () => {
  const root = await mkdtemp(join(tmpdir(), "personal-approval-"));
  const source = await createTestApp();
  const destination = await createTestApp({ storageRoot: join(root, "destination") });
  let stopWatching: (() => void) | undefined;
  try {
    const project = await source.deps.projectService.create({ name: "Approvals" });
    await destination.deps.projectService.create({ id: project.id, name: project.name });
    const session = await source.deps.sessionService.create({
      project_id: project.id,
      title: "Remote approval",
      agent: "fixture-agent",
      status: "in_progress",
    });
    const entry = source.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
    const otherProject = await source.deps.projectService.create({ name: "Other private project" });
    const otherSession = await source.deps.sessionService.create({
      project_id: otherProject.id,
      title: "Other approval",
      agent: "fixture-agent",
    });
    const otherEntry = source.deps.sessionService.store.create(otherSession.id, inertSessionChannelHooks);
    const approval = { id: "approval", toolName: "shell", toolInput: { command: "pwd" }, toolUseId: "tool" };
    const login = {
      managerOrigin: "https://127.0.0.1:1",
      relayOrigin: "https://127.0.0.1:1",
      accountId: "alice",
      deviceId: (await destination.deps.environmentService.get()).environmentId,
      token: "test-only",
    };
    await createNativeStore(nativeAccountFile(":memory:", join(root, "destination"))).save(login);
    await destination.deps.personalHistoryService.refreshIdentity();
    const history = createPersonalHistoryStore({
      ...login,
      projectId: project.id,
      documents: source.deps.extensionStorageService.documents,
      files: source.deps.personalHistoryService.logs,
    });
    const references = createHistoryReferences(
      source.deps.extensionStorageService.documents.open(historyReferenceName),
      project.id,
    );
    const device = { id: "source-device", ownerId: "alice", name: "Laptop" };
    const space = await createSyncSpace({
      projectId: project.id,
      spaceOwner: login.accountId,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const relay = logRelayFixture();
    const remoteHistory = createPersonalHistoryStore({
      ...login,
      projectId: project.id,
      documents: destination.deps.extensionStorageService.documents,
      files: destination.deps.personalHistoryService.logs,
    });
    const capture = async (incremental = false) => {
      const input = { projectId: project.id, device, history, references, deps: source.deps };
      if (incremental) await captureSessionChanges(input, [session.id]);
      else await capturePersonalHistory(input);
      await history.synchronizeIndex(device.id, true, space, relay.relay);
      await remoteHistory.synchronizeIndex(device.id, false, space, relay.relay);
    };
    const changed = new Set<string | undefined>();
    let admitted = false;
    stopWatching = watchPersonalHistory({
      deps: source.deps,
      owner: history.owner,
      announcing: () => false,
      ownsSession: (id) => admitted && id === session.id,
      preview: () => undefined,
      indexChanged: (id) => changed.add(id),
      conversationChanged: () => undefined,
    });
    const captured = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const writeReferences = references.write;
    references.write = async (...args) => {
      captured.resolve();
      await released.promise;
      return writeReferences(...args);
    };
    // Hold first admission after the session row is captured, then request approval without a DB event.
    const initial = capture();
    await captured.promise;
    const otherReply = otherEntry.approvalService.requestApproval({ ...approval, id: "other-approval" });
    const reply = entry.approvalService.requestApproval(approval);
    released.resolve();
    await initial;
    admitted = true;
    expect([...changed]).toEqual([session.id]);
    otherEntry.approvalService.handleResponse({ id: "other-approval", decision: "approve" });
    await otherReply;
    await capture(true);
    expect(await destination.deps.personalHistoryService.getSession(session.id)).toMatchObject({
      approval_requests: [approval],
    });
    changed.clear();
    const frames: unknown[] = [];
    const sink = {
      aborted: false,
      onAbort() {},
      async sleep() {
        entry.approvalService.handleResponse({ id: approval.id, decision: "approve" });
        expect([...changed]).toEqual([session.id]);
        await capture(true);
        destination.deps.eventBus.emit("sessions", "set", { id: session.id });
      },
      async write(event: string, data: unknown) {
        if (event !== "patch" || (data as { path: string }).path !== "/approval_requests") return;
        frames.push((data as { value: unknown }).value);
        if (frames.length === 2) sink.aborted = true;
      },
    };
    await streamPersonalSession(session.id, destination.deps, sink);
    expect(frames).toEqual([[approval], []]);
    expect(await reply).toEqual({ id: approval.id, decision: "approve" });
    expect(destination.deps.sessionService.store.get(session.id)).toBeNull();
    expect(source.deps.sessionService.store.get(session.id)).toBe(entry);
  } finally {
    stopWatching?.();
    await source.close();
    await destination.close();
    await rm(root, { recursive: true, force: true });
  }
});
