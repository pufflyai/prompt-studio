import type { NativeTextTarget } from "pstdio-api-contracts";
import type { StorageOwner } from "pstdio-sync";
import type { resolveNativeTextAccess } from "./source-access";
import { NativeDocumentSourceError } from "./source-error";

/** Admission retains presentation restrictions; the separate projection locator has no view dependency. */
export const nativeAdmissionTarget = (target: NativeTextTarget) =>
  "fileRendererId" in target
    ? { fileRendererId: target.fileRendererId, resource: target.resource, pageParams: target.pageParams }
    : { extensionId: target.extensionId, textDocument: target.textDocument };

export const validateNativeSourceAuthority = (
  loaded: { owner: StorageOwner; documentKey: string },
  expected: { owner: StorageOwner; documentKey: string },
) => {
  if (
    loaded.documentKey !== expected.documentKey ||
    loaded.owner.extensionId !== expected.owner.extensionId ||
    loaded.owner.workbenchId !== expected.owner.workbenchId
  )
    throw new NativeDocumentSourceError(409, "source_retired", "This text source lifetime has changed");
};

export const validateWritableSource = async (
  load: (input: Parameters<typeof resolveNativeTextAccess>[1]) => ReturnType<typeof resolveNativeTextAccess>,
  room: { target: NativeTextTarget; owner: StorageOwner; documentKey: string; editable: boolean },
) => {
  const loaded = await load({ ...room.target, projectId: room.owner.workbenchId });
  validateNativeSourceAuthority(loaded, room);
  if (!room.editable || loaded.content.editable === false)
    throw new NativeDocumentSourceError(403, "source_read_only", "The text source is read only");
};
