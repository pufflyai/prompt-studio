import type { NavigationTarget } from "./types/navigation-target";
import type { ResourceRef } from "./types/resources";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isContributionRef = (value: unknown, kind: string) =>
  isRecord(value) && value.kind === kind && typeof value.id === "string";

const isResource = (value: unknown) =>
  isRecord(value) && typeof value.type === "string" && typeof value.id === "string";

const isOpenIntent = (value: unknown) => value === undefined || value === "preview" || value === "pin";

const isPageTarget = (value: unknown, ancestors = new Set<unknown>()): boolean => {
  if (!isRecord(value) || value.kind !== "page" || !isContributionRef(value.page, "page")) return false;
  if (ancestors.has(value)) return false;
  if (value.resource !== undefined && !isResource(value.resource)) return false;
  if (value.section !== undefined && !isRecord(value.section)) return false;
  if (!isOpenIntent(value.open)) return false;
  if (value.parent === undefined) return true;
  const next = new Set(ancestors);
  next.add(value);
  return isPageTarget(value.parent, next);
};

const isPanelTarget = (value: unknown) => {
  if (!isRecord(value) || value.kind !== "panel" || !isRecord(value.panel)) return false;
  const panel = value.panel;
  const validPanel =
    isContributionRef(panel, "placement") ||
    (panel.kind === "page-slot" && isContributionRef(panel.page, "page") && typeof panel.id === "string");
  return validPanel && (value.resource === undefined || isResource(value.resource)) && isOpenIntent(value.open);
};

const isItemTarget = (value: unknown): value is Exclude<NavigationTarget, { kind: "compound" }> => {
  if (!isRecord(value)) return false;
  if (value.kind === "page") return isPageTarget(value);
  if (value.kind === "panel") return isPanelTarget(value);
  if (value.kind === "href") return typeof value.href === "string";
  return (
    value.kind === "command" &&
    isRecord(value.target) &&
    isContributionRef(value.target.command, "command") &&
    (value.target.params === undefined || isRecord(value.target.params))
  );
};

export const isNavigationTarget = (value: unknown): value is NavigationTarget => {
  if (isItemTarget(value)) return true;
  if (!isRecord(value) || value.kind !== "compound" || !Array.isArray(value.targets) || value.targets.length === 0) {
    return false;
  }
  return value.targets.every((target) => isPageTarget(target) || isPanelTarget(target));
};

const withExtensionOwner = <Ref extends { extensionId?: string }>(ref: Ref, extensionId: string | undefined): Ref =>
  ref.extensionId !== undefined || extensionId === undefined ? ref : ({ ...ref, extensionId } as Ref);

const toPageTarget = (
  target: Extract<NavigationTarget, { kind: "page" }>,
  extensionId: string | undefined,
  projectId?: string,
): Extract<NavigationTarget, { kind: "page" }> => ({
  ...target,
  page: withExtensionOwner(target.page, extensionId),
  ...(target.resource ? { resource: qualifyResource(target.resource, extensionId, projectId) } : {}),
  ...(target.parent ? { parent: toPageTarget(target.parent, extensionId, projectId) } : {}),
});

const qualifyResource = (resource: ResourceRef, extensionId?: string, projectId?: string) => ({
  ...resource,
  extensionId: resource.extensionId ?? extensionId,
  projectId: resource.projectId ?? projectId,
});

export const qualifyNavigationTarget = (
  target: NavigationTarget,
  extensionId: string,
  projectId?: string,
): NavigationTarget => {
  if (!isNavigationTarget(target)) throw new Error("Invalid navigation target.");
  if (target.kind === "page") return toPageTarget(target, extensionId, projectId);
  if (target.kind === "panel")
    return {
      ...target,
      panel:
        target.panel.kind === "page-slot"
          ? { ...target.panel, page: withExtensionOwner(target.panel.page, extensionId) }
          : withExtensionOwner(target.panel, extensionId),
      ...(target.resource ? { resource: qualifyResource(target.resource, extensionId, projectId) } : {}),
    };
  if (target.kind === "command")
    return { ...target, target: { ...target.target, command: withExtensionOwner(target.target.command, extensionId) } };
  if (target.kind === "href") return target;
  return {
    ...target,
    targets: target.targets.map(
      (item) =>
        qualifyNavigationTarget(item, extensionId, projectId) as Extract<NavigationTarget, { kind: "page" | "panel" }>,
    ),
  };
};
