import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";

const ownedRef = <T extends { extensionId?: string }>(ref: T): T =>
  ref.extensionId ? { ...ref, extensionId: canonicalExtensionId(ref.extensionId) } : ref;

/** Decode typed navigation owners without touching resource IDs, params, hrefs or content. */
export const canonicalNavigationOwners = (target: NavigationTarget): NavigationTarget => {
  if (target.kind === "href") return target;
  if (target.kind === "command")
    return { ...target, target: { ...target.target, command: ownedRef(target.target.command) } };
  if (target.kind === "compound")
    return { ...target, targets: target.targets.map((item) => canonicalNavigationOwners(item) as typeof item) };
  if (target.kind === "page")
    return {
      ...target,
      page: ownedRef(target.page),
      resource: target.resource && ownedRef(target.resource),
      parent: target.parent && (canonicalNavigationOwners(target.parent) as typeof target.parent),
    };
  if (target.kind === "dialog")
    return { ...target, page: ownedRef(target.page), resource: target.resource && ownedRef(target.resource) };
  if (target.kind === "viewer")
    return {
      ...target,
      page: target.page && ownedRef(target.page),
      resource: ownedRef(target.resource),
      from: target.from && ownedRef(target.from),
    };
  return {
    ...target,
    resource: target.resource && ownedRef(target.resource),
    panel:
      target.panel.kind === "page-slot"
        ? { ...target.panel, page: ownedRef(target.panel.page) }
        : ownedRef(target.panel),
  };
};
