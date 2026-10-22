import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StorageOwner } from "pstdio-sync";
import { createDocumentStorage, createMemoryDocumentStore } from "pstdio-sync";
import { EventBus } from "../sync/event-bus";
import type { ScheduleAdmissionDeps } from "./deps";
import { loadExtensionSource } from "./extension-runtime";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

// The focused scheduler harness uses real document storage, source loading and command execution.
// Full process/database and encrypted relay wiring are covered by isolated and packaged checks.
export const createDeviceAutomationFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "device-automations-"));
  const projectId = crypto.randomUUID();
  const source = createTestExtensionSource({ root, installName: "clock", name: "clock", displayName: "Clock" });
  await writeFile(
    join(source, "extension.ts"),
    `export default {
    commands: [{ id: "tick", ref: { kind: "command", id: "tick" }, title: "Tick", async run(ctx) {
      await globalThis.__deviceAutomationRun(ctx.invocation.metadata);
    }}],
    schedules: [{ id: "tick", ref: { kind: "schedule", id: "tick" }, title: "Tick", schedule: "* * * * *",
      command: { kind: "command", id: "tick" } }],
  };`,
  );
  const loaded = await loadExtensionSource(source);
  return {
    root,
    projectId,
    scheduleId: "test.clock.schedule.tick",
    async device() {
      const deviceId = crypto.randomUUID();
      const stores = new Map<string, ReturnType<typeof createMemoryDocumentStore>>();
      const listeners = new Set<(owner: StorageOwner) => void>();
      const storeFor = (owner: StorageOwner) => {
        let store = stores.get(owner.extensionId);
        if (!store) {
          store = createMemoryDocumentStore();
          stores.set(owner.extensionId, store);
        }
        return store;
      };
      const extensionStorageService = {
        documents: {
          open: (_name: string) => ({
            transaction: async <T>(
              owner: StorageOwner,
              action: Parameters<ReturnType<typeof createMemoryDocumentStore>["transaction"]>[1],
            ) => {
              const result = await storeFor(owner).transaction(owner, action);
              for (const listener of listeners) listener(owner);
              return result as T;
            },
          }),
        },
        open: async ({ owner }: { owner: StorageOwner }) => {
          const store = storeFor(owner);
          const notify = () => {
            for (const listener of listeners) listener(owner);
          };
          const storage = createDocumentStorage({
            owner,
            store: {
              transaction: store.transaction,
              observer: { read: () => {}, group: (_owner, group) => group, committed: notify },
            },
          });
          return {
            ...storage,
            applyUpdate: async (update: Uint8Array) => {
              await storage.applyUpdate(update);
              notify();
            },
          };
        },
        watch: (listener: (owner: StorageOwner) => void) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
      const extensionService = {
        listEnabledSourcesForProject: async () => [
          {
            instance: { id: "clock" },
            installedSource: {
              id: "clock",
              extension_id: loaded.metadata.id,
              source_kind: "local_path",
              source_path: source,
              status: "loaded",
            },
          },
        ],
      };
      const projectService = { get: async () => ({ id: projectId, name: "Clock", shorthand: "PS" }) };
      const workspaceService = { get: async () => null, getDefault: async () => null };
      const deps = {
        environmentService: { get: async () => ({ environmentId: deviceId }) },
        accountService: { projectSyncStatus: async () => ({ state: "synced", offlineReady: true }) },
        eventBus: new EventBus(),
        extensionStorageService,
        extensionService,
        workspaceService,
        projectService,
        extensionAutomationPreferencesService: { list: async () => [] },
        extensionRuntimeCatalog: createProjectExtensionRuntimeCatalog({
          extensionService,
          projectService,
          workspaceService,
        } as never),
      } as unknown as ScheduleAdmissionDeps;
      return { deps };
    },
    async close() {
      await rm(root, { recursive: true, force: true });
      delete (globalThis as Record<string, unknown>).__deviceAutomationRun;
    },
  };
};
