import { type Publication, publicationSchema, publishedExtensionsId } from "pstdio-sync-contracts";

export { type Publication, publicationSchema, publishedExtensionsId } from "pstdio-sync-contracts";

import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRecordAssets } from "../command-environment/record-assets";
import type { ExtensionsRouteDeps } from "../deps";
import { packExtension } from "./package";
import { preparePublishedExtension } from "./prepare";

export const publishedOwner = (workbenchId: string) => ({ workbenchId, extensionId: publishedExtensionsId });
export const openPublishedCatalog = async (deps: ExtensionsRouteDeps, workbenchId: string, signal?: AbortSignal) => {
  const owner = publishedOwner(workbenchId);
  return deps.extensionStorageService.open({
    owner,
    assets: createRecordAssets(deps.assetTransferService, owner, signal),
  });
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
  const record = await catalog.records.read(installedSource.extension_id);
  if (record.revision !== input.expectedRevision)
    throw new Error("Published extension changed; read its revision again");
  const bytes = await packExtension(installedSource.source_path);
  const asset = await deps.assetTransferService.stage(publishedOwner(input.projectId), crypto.randomUUID(), bytes);
  const prepared = await preparePublishedExtension({
    bytes,
    root: join(tmpdir(), "pstdio-publication"),
    extensionId: installedSource.extension_id,
  });
  const automation = ["hooks", "schedules", "middlewares"].some((key) => {
    const entries = prepared.loaded.definition[key];
    return entries && typeof entries === "object" && Object.keys(entries).length > 0;
  });
  await rm(prepared.path, { recursive: true, force: true });
  const previous = publicationSchema.safeParse(record.value);
  const value: Publication = {
    extensionId: installedSource.extension_id,
    revision: asset.sha256,
    automation,
    enabled: previous.success ? previous.data.enabled : source.instance.enabled,
  };
  return catalog.records.commit({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: value.extensionId, expectedRevision: input.expectedRevision, replace: value, asset }],
  });
};
