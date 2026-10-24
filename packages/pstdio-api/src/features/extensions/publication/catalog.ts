import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRecordAssets } from "../command-environment/record-assets";
import type { ExtensionsRouteDeps } from "../deps";
import { createPublicationCatalog } from "./catalog-store";
import { packExtension } from "./package";
import { preparePublishedExtension } from "./prepare";
import { type Publication, PublicationChangedError, publicationSchema, publishedExtensionsId } from "./types";

export { type Publication, publicationSchema, publishedExtensionsId } from "./types";

export const publishedOwner = (workbenchId: string) => ({ workbenchId, extensionId: publishedExtensionsId });
export const openPublishedCatalog = async (
  deps: Pick<ExtensionsRouteDeps, "extensionStorageService" | "assetTransferService">,
  workbenchId: string,
  signal?: AbortSignal,
) => {
  const owner = publishedOwner(workbenchId);
  const assets = createRecordAssets(deps.assetTransferService, owner, signal);
  // The catalog verifies package bytes before it takes the owner lock, so commits skip a second hash.
  const { records } = await deps.extensionStorageService.open({
    owner,
    assets: { ...assets, verifyComplete: async () => {} },
  });
  return createPublicationCatalog({ records, verifyComplete: assets.verifyComplete });
};

export const publishExtension = async (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; instanceId: string; expectedRevision: string },
) => {
  const source = await deps.extensionService.getProjectExtensionInstance(input.projectId, input.instanceId);
  if (!source) throw new Error("Extension instance not found");
  const { installedSource } = source;
  if (installedSource.extension_id === publishedExtensionsId) throw new Error("Reserved platform extension identity");
  const catalog = await openPublishedCatalog(deps, input.projectId);
  const record = await catalog.read(installedSource.extension_id);
  if (record.revision !== input.expectedRevision) throw new PublicationChangedError();
  const bytes = await packExtension(installedSource.source_path);
  // Validate the package before its bytes are stored, so a rejected source leaves nothing behind.
  const prepared = await preparePublishedExtension({
    bytes,
    root: join(tmpdir(), "pstdio-publication"),
    extensionId: installedSource.extension_id,
  });
  await rm(prepared.path, { recursive: true, force: true });
  const asset = await deps.assetTransferService.stage(publishedOwner(input.projectId), crypto.randomUUID(), bytes);
  const previous = publicationSchema.safeParse(record.value);
  const value: Publication = {
    extensionId: installedSource.extension_id,
    revision: asset.sha256,
    version: prepared.loaded.metadata.version,
    enabled: previous.success ? previous.data.enabled : source.instance.enabled,
  };
  return catalog.select(value, asset, input.expectedRevision);
};
