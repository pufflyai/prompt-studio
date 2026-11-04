import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryDocumentStore } from "pstdio-sync";
import { EventBus } from "../../features/sync/event-bus";
import { createSessionLogFiles } from "./log-files";
import { createPersonalHistoryService } from "./service";

test("an index read held across an account switch cannot return or republish the earlier account's records", async () => {
  const store = createMemoryDocumentStore();
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const root = await mkdtemp(join(tmpdir(), "history-identity-"));
  const logs = createSessionLogFiles(root);
  const indexDevices = logs.indexDevices;
  logs.indexDevices = async (namespace) => {
    started.resolve();
    await released.promise;
    return indexDevices(namespace);
  };
  let accountId = "alice";
  const events = new EventBus();
  const service = createPersonalHistoryService({
    documents: { open: () => store },
    account: {
      status: async () => ({
        login: {
          accountId,
          deviceId: "reader",
          managerOrigin: "https://manager.example",
          relayOrigin: "https://relay.example",
        },
        cloudProjects: [],
        cloudProjectsLoaded: true,
        features: { relay: true },
      }),
    },
    projects: { list: async () => [] },
    eventBus: events,
    logs,
  });
  const delivered: unknown[] = [];
  const stop = service.watchMessages("private-session", (message) => delivered.push(message));
  const pending = service.sessions("project");
  await started.promise;
  accountId = "bob";
  await service.refreshIdentity();
  released.resolve();
  expect(await pending).toEqual([]);
  expect(events.getSince(0)).toEqual([]);
  service.messageReceived("private-session", {
    index: 0,
    live: true,
    message: {
      id: "private",
      role: "assistant",
      parts: [{ type: "text", text: "Alice private message" }],
    },
  });
  expect(delivered).toEqual([]);
  stop();
  await rm(root, { recursive: true, force: true });
});
