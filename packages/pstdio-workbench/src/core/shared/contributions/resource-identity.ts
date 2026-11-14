import type { ResourceRef } from "@pstdio/sdk/extensions";
import { canonicalExtensionId, historicalExtensionId } from "pstdio-api-contracts/extension-host";

export const canonicalResourceRef = (resource: ResourceRef): ResourceRef =>
  resource.extensionId && canonicalExtensionId(resource.extensionId) !== resource.extensionId
    ? { ...resource, extensionId: canonicalExtensionId(resource.extensionId) }
    : resource;
export const historicalResourceRef = (resource: ResourceRef): ResourceRef =>
  resource.extensionId ? { ...resource, extensionId: historicalExtensionId(resource.extensionId) } : resource;
