import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";

/** Bound selection and authority affect a read; resolved display fields do not. */
export const resourceReadIdentity = (resource: ResourceRef | undefined) => [
  resourceKey(resource),
  resource?.device,
  resource?.metadata,
];
