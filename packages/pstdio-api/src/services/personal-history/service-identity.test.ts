import { expect, test } from "bun:test";
import { createMemoryDocumentStore } from "pstdio-sync";
import { EventBus } from "../../features/sync/event-bus";
import { createPersonalHistoryService } from "./service";
import { personalHistoryOwner } from "./store";

test("a document read held across an account switch cannot return or republish the earlier account's records", async () => {
  const store = createMemoryDocumentStore();
  await store.transaction(
    personalHistoryOwner({ projectId: "project", accountId: "alice", managerOrigin: "https://manager.example" }),
    async ({ document }) => {
      document.getMap("sessions").set(
        "private-session",
        JSON.stringify({
          id: "private-session",
          project_id: "project",
          title: "Alice private conversation",
          status: "completed",
          archived: false,
          last_request_started: null,
          last_request_ended: null,
          agent: null,
          last_selected_model: null,
          agent_session_id: null,
          session_file_id: null,
          original_session_id: null,
          cwd: null,
          params_json: null,
          usage_json: null,
          workspace_id: null,
          anchors_json: [],
          created_at: "2026-10-20T00:00:00.000Z",
          updated_at: "2026-10-20T00:00:00.000Z",
          device: { ownerId: "alice", id: "source-device", name: "Laptop" },
        }),
      );
    },
  );
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  let accountId = "alice";
  const events = new EventBus();
  const service = createPersonalHistoryService({
    documents: {
      open: () => ({
        transaction: async (owner, action) => {
          started.resolve();
          await released.promise;
          return store.transaction(owner, action);
        },
      }),
    },
    account: {
      status: async () => ({
        login: {
          accountId,
          deviceId: "reader",
          managerOrigin: "https://manager.example",
          relayOrigin: "https://relay.example",
        },
        cloudProjects: [],
      }),
    },
    projects: { list: async () => [] },
    eventBus: events,
  });
  const pending = service.sessions("project");
  await started.promise;
  accountId = "bob";
  await service.refreshIdentity();
  released.resolve();
  expect(await pending).toEqual([]);
  expect(events.getSince(0)).toEqual([]);
});
