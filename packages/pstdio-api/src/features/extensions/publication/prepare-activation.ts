import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Asset } from "pstdio-sync-contracts";
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

export const preparePublicationActivation = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  publication: Publication,
  asset: Asset,
  stages: string[],
  signal?: AbortSignal,
  adopt: boolean | string = false,
  beforeCommit?: () => Promise<void>,
) => {
  const adopting = adopt === true || adopt === publication.extensionId;
  if (asset.sha256 !== publication.revision) throw new Error("Published revision does not match its package");
  await deps.assetTransferService.verifyComplete(publishedOwner(projectId), [asset], signal);
  const previous = selectPublicationSource(
    (await deps.extensionService.listProjectExtensionInstances(projectId)).filter(
      ({ installedSource }) => installedSource.extension_id === publication.extensionId,
    ),
  );
  const baseline = previous
    ? await publishedSourceBaseline(deps, projectId, previous.installedSource.source_ref, asset)
    : null;
  const privateSource =
    previous &&
    existsSync(previous.installedSource.source_path) &&
    !(await sourceMatchesPublication(previous.installedSource.source_path, baseline));
  const unchanged =
    previous &&
    existsSync(previous.installedSource.source_path) &&
    publishedRevisionOf(previous.installedSource.source_ref) === publication.revision;
  const checkCurrent = async () => {
    signal?.throwIfAborted();
    await beforeCommit?.();
    const current = selectPublicationSource(
      (await deps.extensionService.listProjectExtensionInstances(projectId)).filter(
        ({ installedSource }) => installedSource.extension_id === publication.extensionId,
      ),
    );
    if (current?.installedSource.id !== previous?.installedSource.id)
      throw new Error("Extension changed during activation; retry");
    if (
      previous &&
      !adopting &&
      !privateSource &&
      existsSync(previous.installedSource.source_path) &&
      !(await sourceMatchesPublication(previous.installedSource.source_path, baseline))
    )
      throw new Error("Local override changed during activation; retry");
  };
  const plan = {
    projectId,
    instanceId: previous?.instance.id,
    enabled: publication.enabled,
    beforeActivate: checkCurrent,
  };
  if (!adopting && previous && (privateSource || unchanged)) {
    return {
      plan:
        previous.instance.enabled !== publication.enabled
          ? { ...plan, source: { kind: "existing" as const, id: previous.installedSource.id } }
          : undefined,
      status: privateSource ? "local-override" : "active",
    };
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
  stages.push(prepared.path);
  if (prepared.loaded.metadata.version !== publication.version) throw new Error("Published package version mismatch");
  return {
    plan: {
      ...plan,
      keepReplacedFolder: adopting,
      source: { kind: "prepared" as const, ...prepared, revision: publication.revision },
    },
    status: "active",
  };
};
