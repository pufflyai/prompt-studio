import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StorageOwner } from "pstdio-sync";
import { createMemoryDocumentStore } from "pstdio-sync";
import { createDocumentStorage } from "pstdio-sync/records";
import { createTestExtensionProcessOwners } from "../../test-utils/create-test-extension-process-owners";
import { createExtensionProbe } from "../../test-utils/extension-probe";
import { EventBus } from "../sync/event-bus";
import type { ScheduleAdmissionDeps } from "./deps";
import type { openDeviceAutomations } from "./device-automations";
import { loadExtensionSource } from "./extension-runtime";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

// The focused scheduler harness uses real document storage, source loading and command execution.
// Full process/database and encrypted relay wiring are covered by isolated and packaged checks.
export const createDeviceAutomationFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "device-automations-"));
  const projectId = crypto.randomUUID();
  const source = createTestExtensionSource({ root, installName: "clock", name: "clock", displayName: "Clock" });
  const probe = createExtensionProbe();
  // The command runs in a worker; each run and each cancellation reaches the test through the probe.
  let onRun: (metadata: unknown) => unknown = () => null;
  let onAbort: () => unknown = () => null;
  probe.answer((value) =>
    value !== null && typeof value === "object" && "$aborted" in value ? onAbort() : onRun(value),
  );
  await writeFile(
    join(source, "extension.ts"),
    `export default {
    commands: [{ id: "tick", ref: { kind: "command", id: "tick" }, title: "Tick", async run(ctx) {
      const aborted = new Promise((resolve) => ctx.signal?.addEventListener("abort", resolve, { once: true }));
      await Promise.race([${probe.request("ctx.invocation.metadata")}, aborted]);
      if (ctx.signal?.aborted) await ${probe.call("{ $aborted: true }")};
    }}],
    schedules: [{ id: "tick", ref: { kind: "schedule", id: "tick" }, title: "Tick", schedule: "* * * * *",
      command: { kind: "command", id: "tick" } }],
  };`,
  );
  const loaded = await loadExtensionSource(source);
  const processOwners: ReturnType<typeof createTestExtensionProcessOwners>[] = [];
  return {
    root,
    projectId,
    scheduleId: "test.clock.schedule.tick",
    /** Answers each run of the scheduled command with its invocation metadata. */
    onRun: (answer: (metadata: unknown) => unknown) => {
      onRun = answer;
    },
    /** Answers once a running command's signal aborted; the command ends when this settles. */
    onAbort: (answer: () => unknown) => {
      onAbort = answer;
    },
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
      const extensionProcessOwners = createTestExtensionProcessOwners(extensionService.listEnabledSourcesForProject);
      processOwners.push(extensionProcessOwners);
      const deps = {
        extensionProcessOwners,
        environmentService: { get: async () => ({ environmentId: deviceId }) },
        accountService: {
          watch: () => () => {},
          projectSyncStatus: async () => ({ state: "synced", offlineReady: true }),
        },
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
      await Promise.all(processOwners.splice(0).map((owner) => owner.dispose()));
      await probe.stop();
      await rm(root, { recursive: true, force: true });
    },
  };
};

type AutomationCatalog = Awaited<ReturnType<typeof openDeviceAutomations>>;

/** Copies one device's current automation records to another, as a sync delivery would. */
export const replicateRecords = async (from: AutomationCatalog, to: AutomationCatalog) => {
  const records = await from.records.list();
  if (!records.length) return;
  await to.records.commit({
    operationId: crypto.randomUUID(),
    edits: records.map((record) => ({ recordId: record.recordId, replace: record.value })),
  });
};
