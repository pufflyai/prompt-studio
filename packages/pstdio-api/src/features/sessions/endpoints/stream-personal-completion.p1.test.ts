import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage } from "pstdio-api-contracts";
import { createNativeStore } from "../../../services/account/native-store";
import { messageEntries } from "../../../services/personal-history/log-entries";
import { historyNamespace } from "../../../services/personal-history/log-files";
import { createPersonalHistoryStore } from "../../../services/personal-history/store";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { SessionEventSink } from "../session-stream-connections";
import { streamPersonalSession } from "./stream-personal-session";

test.each([
  "its final durable page",
  "the matching terminal publication",
  "an empty-log publication",
  "a newer completion during the final snapshot",
])("a completed personal stream waits for %s", async (waitingFor) => {
  const root = await mkdtemp(join(tmpdir(), "personal-completion-"));
  const source = await createTestApp();
  const destination = await createTestApp({
    databasePath: join(root, "database"),
    storageRoot: join(root, "storage"),
  });
  const controller = new AbortController();
  const waiting = Promise.withResolvers<void>();
  const tick = Promise.withResolvers<void>();
  const finalWriteEntered = Promise.withResolvers<void>();
  const finalWriteRelease = Promise.withResolvers<void>();
  let running: Promise<boolean> | undefined;
  try {
    const project = await source.deps.projectService.create({ name: "Completed personal history" });
    await destination.deps.projectService.create({ id: project.id, name: project.name });
    const session = await source.deps.sessionService.create({
      project_id: project.id,
      title: "Completed conversation",
      status: "completed",
      agent: "unavailable",
    });
    const row = { ...session, workspace_id: null, updated_at: "2026-01-02T00:00:00.000Z" };
    const login = {
      managerOrigin: "https://127.0.0.1:1",
      relayOrigin: "https://127.0.0.1:1",
      accountId: "reader",
      deviceId: (await destination.deps.environmentService.get()).environmentId,
      token: "offline-credential",
    };
    // Prime the anonymous reader before injecting the fixture's native login.
    // A file write bypasses the normal account owner's identity notification.
    await destination.deps.personalHistoryService.refreshIdentity();
    await createNativeStore(join(root, "native-account.json")).save(login);
    await destination.deps.personalHistoryService.refreshIdentity();
    const history = createPersonalHistoryStore({
      ...login,
      projectId: project.id,
      documents: destination.deps.extensionStorageService.documents,
      index: destination.deps.extensionStorageService.personalHistoryIndex,
      logs: destination.deps.extensionStorageService.logs,
    });
    const device = { ownerId: login.accountId, id: "other-device", name: "Laptop" };
    await history.writeRecords("sessions", device, [row]);
    const version = () => JSON.stringify([row.status, row.updated_at]);
    const publish = (head: number, publishedVersion = version()) =>
      history.writeHeads(new Map([[session.id, head]]), new Map([[session.id, { head, version: publishedVersion }]]));
    const namespace = historyNamespace({ ...login, projectId: project.id });
    const logs = destination.deps.personalHistoryService.logs;
    const messages: SessionMessage[] = [
      { id: "earlier", role: "assistant", parts: [{ type: "text", text: "Earlier message" }] },
      { id: "final", role: "assistant", parts: [{ type: "text", text: "Final durable message" }] },
    ];
    const empty = waitingFor === "an empty-log publication";
    if (!empty) await logs.savePage(namespace, session.id, 1, messageEntries(0, messages[0]!));
    if (waitingFor === "its final durable page") await publish(2);
    if (waitingFor === "the matching terminal publication")
      await publish(1, JSON.stringify([row.status, "2026-01-01T00:00:00.000Z"]));
    const newerCompletion = waitingFor === "a newer completion during the final snapshot";
    if (newerCompletion) await publish(1);
    let snapshot: SessionMessage[] = [];
    let end: unknown;
    let snapshots = 0;
    const sink: SessionEventSink = {
      get aborted() {
        return controller.signal.aborted;
      },
      onAbort() {},
      async sleep() {
        waiting.resolve();
        await tick.promise;
      },
      async write(event, data) {
        if (event === "patch") {
          const patch = data as { path: string; value: SessionMessage[] };
          if (patch.path === "/messages") {
            snapshot = structuredClone(patch.value);
            snapshots++;
            if (newerCompletion && snapshots === 2) {
              finalWriteEntered.resolve();
              await finalWriteRelease.promise;
            }
          }
        }
        if (event === "end") end = data;
      },
    };
    running = streamPersonalSession(session.id, destination.deps, sink);
    if (newerCompletion) {
      await finalWriteEntered.promise;
      row.updated_at = "2026-01-03T00:00:00.000Z";
      await history.writeRecords("sessions", device, [row]);
      await publish(2);
      finalWriteRelease.resolve();
    }
    expect(await Promise.race([waiting.promise.then(() => "waiting"), running.then(() => "ended")])).toBe("waiting");
    expect(end).toBeUndefined();
    if (!empty) await logs.savePage(namespace, session.id, 2, messageEntries(1, messages[1]!));
    await publish(empty ? 0 : 2);
    // The durable file can commit before its message notification reaches this reader.
    tick.resolve();
    expect(await running).toBe(true);
    expect(snapshot).toEqual(empty ? [] : messages);
    expect(end).toEqual({ status: "completed" });
  } finally {
    controller.abort();
    tick.resolve();
    finalWriteRelease.resolve();
    await running?.catch(() => {});
    await Promise.all([source.close(), destination.close()]);
    await rm(root, { recursive: true, force: true });
  }
});
