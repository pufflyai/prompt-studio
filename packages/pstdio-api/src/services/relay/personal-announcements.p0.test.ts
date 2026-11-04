import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryDocumentStore } from "pstdio-sync";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { EventBus } from "../../features/sync/event-bus";
import { memoryPersonalIndexFixture } from "../personal-history/index.fixture";
import { createSessionLogFiles } from "../personal-history/log-files";
import { createPersonalHistoryService } from "../personal-history/service";
import { createPersonalHistoryStore } from "../personal-history/store";
import { createPersonalAnnouncements } from "./personal-announcements";

test("head-only synchronization skips visible history scans; edits, removal, identity and clear reconcile", async () => {
  const root = await mkdtemp(join(tmpdir(), "history-announcements-"));
  try {
    const files = createSessionLogFiles(root);
    const documents = { open: () => createMemoryDocumentStore() };
    const identity = { projectId: "project", accountId: "alice", managerOrigin: "https://manager.example" };
    const device = { ownerId: "alice", id: "source", name: "Laptop" };
    const index = memoryPersonalIndexFixture();
    const store = createPersonalHistoryStore({ ...identity, files, documents, ...index });
    const links = Array.from({ length: 2003 }, (_, i) => ({
      id: `link-${i}`,
      workspace_id: "workspace",
      session_id: `session-${i}`,
      created_at: "2026-11-04T00:00:00Z",
    }));
    await store.writeRecords("workspace_sessions", device, links);
    let accountId = "alice";
    const eventBus = new EventBus();
    const service = createPersonalHistoryService({
      documents,
      logs: files,
      index: index.index,
      logStreams: index.logs,
      eventBus,
      account: {
        status: async () => ({
          login: { ...identity, accountId, deviceId: "reader", relayOrigin: "https://relay.example" },
          cloudProjects: [],
          cloudProjectsLoaded: true,
          features: { relay: true },
        }),
      },
      projects: { list: async () => [] },
    });
    let scans = 0;
    const fullState = service.fullState;
    service.fullState = (...args) => {
      scans++;
      return fullState(...args);
    };
    const announcements = createPersonalAnnouncements(
      { personalHistoryService: service, eventBus } as ExtensionsRouteDeps,
      identity.projectId,
      new AbortController().signal,
    );
    await announcements.announce();
    expect(scans).toBe(1);
    expect(eventBus.seq).toBe(2003);
    await store.writeHeads(new Map([["session-0", 1]]), new Map([["session-0", { head: 1, version: "complete" }]]));
    await announcements.announce();
    expect(scans).toBe(1);
    expect(eventBus.seq).toBe(2003);
    await store.patchRecords("workspace_sessions", device, [{ ...links[0]!, workspace_id: "renamed" }], ["link-1"]);
    await announcements.announce();
    expect(scans).toBe(2);
    expect(
      eventBus
        .getSince(0)
        .slice(-2)
        .map(({ op, data }) => ({ op, data })),
    ).toEqual([
      { op: "set", data: { ...links[0], workspace_id: "renamed", device } },
      { op: "delete", data: { id: "link-1" } },
    ]);
    accountId = "bob";
    await service.refreshIdentity();
    await announcements.announce();
    expect(scans).toBe(3);
    accountId = "alice";
    await service.refreshIdentity();
    await announcements.announce();
    expect(scans).toBe(4);
    announcements.clear();
    await announcements.announce();
    expect(scans).toBe(5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
