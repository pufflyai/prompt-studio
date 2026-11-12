import type { ResourceRef } from "@pstdio/sdk/extensions";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-identity";
import type { NavigationTarget } from "../../registries/navigation/navigation-registry";

const owned = <T extends { extensionId?: string }>(ref: T): T =>
  ref.extensionId ? { ...ref, extensionId: canonicalExtensionId(ref.extensionId) } : ref;
export const canonicalNavigationTarget = (target: NavigationTarget): NavigationTarget => {
  if (target.kind === "compound")
    return { ...target, targets: target.targets.map(canonicalNavigationTarget) } as NavigationTarget;
  if (["command", "href"].includes(target.kind)) return target;
  const resource = "resource" in target && target.resource ? owned(target.resource as ResourceRef) : undefined;
  if (target.kind === "page")
    return {
      ...target,
      page: owned(target.page),
      ...(resource && { resource }),
      parent: target.parent ? (canonicalNavigationTarget(target.parent) as typeof target.parent) : undefined,
    };
  if (target.kind === "dialog") return { ...target, page: owned(target.page), ...(resource && { resource }) };
  if (target.kind === "panel" && target.panel.kind === "shell-placement") return target;
  if (target.kind === "panel")
    return {
      ...target,
      ...(resource && { resource }),
      panel:
        target.panel.kind === "page-slot"
          ? { ...target.panel, page: owned(target.panel.page) }
          : owned(target.panel as import("@pstdio/sdk/extensions").PlacementRef),
    };
  if (target.kind === "viewer")
    return { ...target, page: target.page ? owned(target.page) : undefined, ...(resource && { resource }) };
  return target;
};
