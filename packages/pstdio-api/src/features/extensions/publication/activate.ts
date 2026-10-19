import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { Asset } from "pstdio-sync-contracts";
import { provisionProjectWorkspaces } from "../../workspaces/provision-coordinator";
import type { ExtensionsRouteDeps } from "../deps";
import { resolvePstdioHome } from "../install-extension-source";
import { type Publication, publishedOwner } from "./catalog";
import { preparePublishedExtension } from "./prepare";
import { publishedRevisionOf, publishedSourceBaseline, sourceMatchesPublication } from "./source";

export const selectPublicationSource = <
  T extends { instance: { enabled: boolean; updated_at: string; created_at: string } },
>(
  matches: T[],
) =>
  matches.find(({ instance }) => instance.enabled) ??
  [...matches].sort(
    (a, b) =>
      b.instance.updated_at.localeCompare(a.instance.updated_at) ||
      b.instance.created_at.localeCompare(a.instance.created_at),
  )[0];
class PublicationOverrideError extends Error {}

const setSharedEnabled = async (
  deps: ExtensionsRouteDeps,
  publication: Publication,
  source:
    | Awaited<ReturnType<ExtensionsRouteDeps["extensionService"]["listProjectExtensionInstances"]>>[number]
    | undefined,
) => {
  if (publication.automation && source && source.instance.enabled !== publication.enabled)
    await deps.extensionService.setProjectExtensionEnabled(source.instance.id, publication.enabled);
};

const applyPublication = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  publication: Publication,
  asset: Asset,
  signal?: AbortSignal,
  adopt = false,
) => {
  if (asset.sha256 !== publication.revision) throw new Error("Published revision does not match its package");
  const instances = await deps.extensionService.listProjectExtensionInstances(projectId);
  const matches = instances.filter(({ installedSource }) => installedSource.extension_id === publication.extensionId);
  const previous = selectPublicationSource(matches);
  let localOverride = false;
  const baseline =
    previous && !adopt
      ? await publishedSourceBaseline(deps, projectId, previous.installedSource.source_ref, asset)
      : null;
  if (previous) {
    const { installedSource } = previous;
    const revision = publishedRevisionOf(installedSource.source_ref);
    const exists = existsSync(installedSource.source_path);
    localOverride = !baseline || (exists && !(await sourceMatchesPublication(installedSource.source_path, baseline)));
    if (!adopt && exists && !localOverride && revision === publication.revision) {
      await setSharedEnabled(deps, publication, previous);
      return "active";
    }
  }
  await deps.assetTransferService.verifyComplete(publishedOwner(projectId), [asset], signal);
  if (!adopt && localOverride) {
    await setSharedEnabled(deps, publication, previous);
    return "local-override";
  }
  const bytes = await new Response(
    await deps.assetTransferService.read(publishedOwner(projectId), asset, signal),
  ).blob();
  const prepared = await preparePublishedExtension({
    bytes,
    root: join(resolvePstdioHome({ env: process.env }), "cache", "published-extensions"),
    extensionId: publication.extensionId,
    signal,
  });
  try {
    signal?.throwIfAborted();
    const checkCurrent = async () => {
      const current = selectPublicationSource(
        (await deps.extensionService.listProjectExtensionInstances(projectId)).filter(
          ({ installedSource }) => installedSource.extension_id === publication.extensionId,
        ),
      );
      if (current?.installedSource.id !== previous?.installedSource.id) throw new PublicationOverrideError();
      if (
        previous &&
        !adopt &&
        (localOverride ||
          (existsSync(previous.installedSource.source_path) &&
            !(await sourceMatchesPublication(previous.installedSource.source_path, baseline))))
      )
        throw new PublicationOverrideError();
      signal?.throwIfAborted();
    };
    await deps.extensionRuntimeCatalog.validateResourcePrefixes(projectId, {
      extension_id: publication.extensionId,
      source_kind: "registry",
      source_path: prepared.path,
    });
    await checkCurrent();
    const enabled = publication.automation ? publication.enabled : undefined;
    await deps.extensionService.activatePublishedExtension({
      projectId,
      instanceId: previous?.instance.id,
      enabled,
      beforeActivate: checkCurrent,
      path: prepared.path,
      revision: publication.revision,
      loaded: prepared.loaded,
    });
    deps.extensionRuntimeCatalog.invalidate({ projectId, reason: "source_changed" });
    await provisionProjectWorkspaces(deps, projectId);
    return "active";
  } catch (error) {
    // Only unregistered staging directories can be discarded. The source owner
    // retains a registered revision so a completed activation remains usable.
    if (
      !(await deps.extensionService.listProjectExtensionInstances(projectId)).some(
        ({ installedSource }) => installedSource.source_path === prepared.path,
      )
    )
      await rm(prepared.path, { recursive: true, force: true });
    if (error instanceof PublicationOverrideError) return "local-override";
    throw error;
  }
};

// A reconnect and an explicit adoption can arrive together. Only one activation
// may select and replace a workbench's source at a time.
const activationQueues = new WeakMap<ExtensionsRouteDeps["extensionService"], Map<string, Promise<unknown>>>();
export const activatePublication = (...args: Parameters<typeof applyPublication>) => {
  const [deps, projectId, publication] = args;
  let queues = activationQueues.get(deps.extensionService);
  if (!queues) {
    queues = new Map();
    activationQueues.set(deps.extensionService, queues);
  }
  const key = JSON.stringify([projectId, publication.extensionId]);
  const result = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(() => applyPublication(...args));
  queues.set(key, result);
  return result.finally(() => {
    if (queues.get(key) === result) queues.delete(key);
  });
};
