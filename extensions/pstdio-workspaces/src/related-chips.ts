import { type ResourceRef, type ResourceResolution, resourceKey } from "@pstdio/sdk/extensions";
export const relatedChips = (targets: ResourceRef[], resolutions: ResourceResolution[]) =>
  targets.map((target) => {
    const resolved = resolutions.find((item) => resourceKey(item.resource) === resourceKey(target));
    return {
      id: resourceKey(target),
      label: resolved?.resource.label ?? target.label ?? target.id,
      ...(resolved?.target ? { action: resolved.target } : {}),
    };
  });
