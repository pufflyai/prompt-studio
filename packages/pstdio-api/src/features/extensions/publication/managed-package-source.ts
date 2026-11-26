import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import { AccountRequestError } from "../../../services/account/account-errors";
import type { ExtensionsRouteDeps } from "../deps";
import { packExtension } from "./package";
import { preparePublishedExtension } from "./prepare";
import { publishedExtensionsId } from "./types";

export const exportManagedPackage = async (deps: ExtensionsRouteDeps, projectId: string, instanceId: string) => {
  const requireAccess = async () => {
    if (!(await deps.accountService.canPublishProjectExtensions(projectId)))
      throw new AccountRequestError("Current project access is required to share this project's tools");
  };
  await requireAccess();
  const source = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
  if (!source) throw new AccountRequestError("Choose an installed extension from this project");
  const extensionId = canonicalExtensionId(source.installedSource.extension_id);
  if (extensionId === publishedExtensionsId)
    throw new AccountRequestError("This platform identity cannot be team-managed");
  const bytes = await packExtension(source.installedSource.source_path);
  const prepared = await preparePublishedExtension({
    bytes,
    extensionId,
    root: join(tmpdir(), "pstdio-managed-check"),
  });
  try {
    await requireAccess();
    return { extensionId, bytes, name: prepared.loaded.metadata.displayName, version: prepared.loaded.metadata.version };
  } finally {
    await rm(prepared.path, { recursive: true, force: true });
  }
};
