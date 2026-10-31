import { rm } from "node:fs/promises";
import type { Asset } from "pstdio-sync-contracts";
import { scheduleProjectWorkspaceProvisioning } from "../../workspaces/provision-coordinator";
import type { ExtensionsRouteDeps } from "../deps";
import { openPublishedCatalog, type Publication } from "./catalog";
import { preparePublicationActivation } from "./prepare-activation";

interface Entry {
  publication: Publication;
  asset: Asset;
}
const activationQueues = new WeakMap<ExtensionsRouteDeps["extensionService"], Map<string, Promise<unknown>>>();

const discardUnregisteredStages = async (deps: ExtensionsRouteDeps, projectId: string, stages: string[]) => {
  const installed = await deps.extensionService.listProjectExtensionInstances(projectId);
  for (const path of stages)
    if (!installed.some(({ installedSource }) => installedSource.source_path === path))
      await rm(path, { recursive: true, force: true });
};

const applySet = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  entries: Entry[],
  signal?: AbortSignal,
  adopt: boolean | string = false,
  beforeCommit?: () => Promise<void>,
) => {
  const stages: string[] = [];
  const plans: Parameters<ExtensionsRouteDeps["extensionService"]["activatePublishedExtensions"]>[0] = [];
  const statuses: string[] = [];
  try {
    for (const { publication, asset } of entries) {
      const prepared = await preparePublicationActivation(
        deps,
        projectId,
        publication,
        asset,
        stages,
        signal,
        adopt,
        beforeCommit,
      );
      if (prepared.plan) plans.push(prepared.plan);
      statuses.push(prepared.status);
    }
    const selectedIds = new Set(entries.map((entry) => entry.publication.extensionId));
    const catalog = await openPublishedCatalog(deps, projectId);
    for (const current of await deps.extensionService.listProjectExtensionInstances(projectId)) {
      if (selectedIds.has(current.installedSource.extension_id) || !current.instance.enabled) continue;
      if ((await catalog.records.read(current.installedSource.extension_id)).deleted)
        plans.push({
          projectId,
          instanceId: current.instance.id,
          enabled: false,
          source: { kind: "existing", id: current.installedSource.id },
          beforeActivate: async () => signal?.throwIfAborted(),
        });
    }
    const proposed = new Map<
      string,
      Parameters<ExtensionsRouteDeps["extensionRuntimeCatalog"]["validateResourcePrefixSet"]>[0][number]
    >(
      (await deps.extensionService.listProjectExtensionInstances(projectId))
        .filter((record) => record.instance.enabled)
        .map((record) => [record.installedSource.extension_id, record.installedSource]),
    );
    for (const plan of plans) {
      const candidate =
        plan.source.kind === "prepared"
          ? {
              extension_id: plan.source.loaded.metadata.id,
              source_kind: "registry" as const,
              source_path: plan.source.path,
            }
          : await deps.extensionService.getInstalledSourceById(plan.source.id);
      if (!candidate) throw new Error("Published source disappeared");
      proposed.delete(candidate.extension_id);
      if (plan.enabled) proposed.set(candidate.extension_id, candidate);
    }
    await deps.extensionRuntimeCatalog.validateResourcePrefixSet([...proposed.values()]);
    await beforeCommit?.();
    for (const plan of plans) await plan.beforeActivate();
    await deps.extensionService.activatePublishedExtensions(plans);
    if (stages.length) {
      deps.extensionRuntimeCatalog.invalidate({ projectId, reason: "source_changed" });
      scheduleProjectWorkspaceProvisioning(deps, projectId);
    }
    return statuses;
  } finally {
    await discardUnregisteredStages(deps, projectId, stages);
  }
};

export const activatePublishedSet = (...args: Parameters<typeof applySet>) => {
  const [deps, projectId] = args;
  let queues = activationQueues.get(deps.extensionService);
  if (!queues) {
    queues = new Map();
    activationQueues.set(deps.extensionService, queues);
  }
  const result = (queues.get(projectId) ?? Promise.resolve()).catch(() => {}).then(() => applySet(...args));
  queues.set(projectId, result);
  return result.finally(() => {
    if (queues.get(projectId) === result) queues.delete(projectId);
  });
};
