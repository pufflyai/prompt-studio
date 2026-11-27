import type { Asset, TeamExtensionPolicy } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../deps";
import { openPublishedCatalog, publicationSchema, publishedOwner } from "./catalog";
import { ordinaryPublicationAllowed, publicationRemoved } from "./team-policy";
import type { Publication } from "./types";

export interface PublicationEntry {
  publication: Publication;
  asset: Asset;
}

export const cachedManagedPublicationAsset = async (
  deps: Pick<ExtensionsRouteDeps, "assetTransferService">,
  projectId: string,
  revision: string,
  signal?: AbortSignal,
) => {
  const cached = await deps.assetTransferService.get(publishedOwner(projectId), `team-managed:${revision}`, signal);
  return cached?.status === "complete" && cached.asset.sha256 === revision ? cached.asset : null;
};

/** Data writes follow the same effective package as activation, including released-policy epochs. */
export const readEffectivePublicationSelection = async (
  deps: Pick<ExtensionsRouteDeps, "accountService" | "assetTransferService" | "extensionStorageService">,
  projectId: string,
  extensionId: string,
) => {
  const policy = await deps.accountService.readCachedManagedProjectPolicy(projectId);
  const required = policy.find((row) => row.extensionId === extensionId)?.required;
  if (required) {
    return {
      publication: {
        extensionId,
        version: required.version,
        revision: required.revision,
        enabled: true,
      },
      // Writers check the invoking revision. Reading and hashing package bytes is only needed for migration.
      asset: null,
      managed: true,
    };
  }
  const catalog = await openPublishedCatalog(deps, projectId);
  const record = await catalog.readOrdinary(extensionId, policy);
  if (!record) return null;
  if (record.damaged) return "damaged" as const;
  return record.value && !record.deleted
    ? { publication: publicationSchema.parse(record.value), asset: record.asset, managed: false }
    : null;
};

export const publicationRemovalPlans = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  selectedIds: Set<string>,
  policy: TeamExtensionPolicy[],
  signal?: AbortSignal,
) => {
  const plans: Parameters<ExtensionsRouteDeps["extensionService"]["activatePublishedExtensions"]>[0] = [];
  const catalog = await openPublishedCatalog(deps, projectId);
  for (const current of await deps.extensionService.listProjectExtensionInstances(projectId)) {
    if (selectedIds.has(current.installedSource.extension_id) || !current.instance.enabled) continue;
    const selection = await catalog.records.read(current.installedSource.extension_id);
    if (!ordinaryPublicationAllowed(policy, current.installedSource.extension_id, selection.value)) continue;
    if (publicationRemoved(selection))
      plans.push({
        projectId,
        instanceId: current.instance.id,
        enabled: false,
        source: { kind: "existing", id: current.installedSource.id },
        beforeActivate: async () => signal?.throwIfAborted(),
      });
  }
  return plans;
};

/** Manager-selected bytes stay native; ordinary shared records cannot substitute them. */
export const effectivePublicationSet = async (
  deps: Pick<ExtensionsRouteDeps, "accountService" | "assetTransferService">,
  projectId: string,
  entries: PublicationEntry[],
  policy: TeamExtensionPolicy[],
  signal?: AbortSignal,
) => {
  const ordinary = entries.filter(({ publication }) =>
    ordinaryPublicationAllowed(policy, publication.extensionId, publication),
  );
  const owner = publishedOwner(projectId);
  for (const { required } of policy) {
    if (!required) continue;
    signal?.throwIfAborted();
    const operationId = `team-managed:${required.revision}`;
    let asset = await cachedManagedPublicationAsset(deps, projectId, required.revision, signal);
    if (!asset) {
      const bytes = await deps.accountService.downloadManagedPackage(projectId, required, signal);
      const revision = new Bun.CryptoHasher("sha256").update(await bytes.arrayBuffer()).digest("hex");
      if (revision !== required.revision) throw new Error("Managed package does not match its required revision");
      asset = await deps.assetTransferService.stage(owner, operationId, bytes, signal);
    }
    ordinary.push({
      publication: {
        extensionId: required.extensionId,
        revision: required.revision,
        version: required.version,
        enabled: true,
      },
      asset,
    });
  }
  return ordinary;
};
