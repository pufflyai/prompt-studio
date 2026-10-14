import { defaultPageResourceCodec, type ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageResourceCodec } from "../pages/page-registry";

export const createAvailablePageResourceCodec = (
  codec: WorkbenchPageResourceCodec = defaultPageResourceCodec,
  isRemoved: (resource: ResourceRef) => boolean,
) => ({
  ...codec,
  normalize(resource: ResourceRef) {
    const normalized = codec.normalize(resource);
    if (isRemoved(normalized)) throw new Error(`Resource was deleted: ${normalized.type}/${normalized.id}`);
    return normalized;
  },
});
