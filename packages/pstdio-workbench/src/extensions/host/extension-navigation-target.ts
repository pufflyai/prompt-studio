import type { NavigationTarget as ExtensionNavigationTarget, ExtensionPlacementStrategy } from "@pstdio/sdk/extensions";
import type { NavigationTarget, NavigationTargetCommand, ResourceRef } from "../../core";
import { toWorkbenchResource } from "./workbench-extension-command";

export interface ExtensionNavigationSourcePlacement {
  instanceId: string;
}

export interface ToWorkbenchNavigationTargetInput {
  commandIdOf?(
    command: Extract<ExtensionNavigationTarget, { kind: "command" }>["target"]["command"],
  ): string | undefined;
  commandTargetOf?(target: Extract<ExtensionNavigationTarget, { kind: "command" }>): NavigationTargetCommand;
  extensionId?: string;
  resourceOf?(
    resource: Parameters<typeof toWorkbenchResource>[0],
    target: Extract<ExtensionNavigationTarget, { kind: "resource" }>,
  ): ResourceRef;
  sourcePlacement?: ExtensionNavigationSourcePlacement;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isContributionRef = (value: unknown, kind: string) =>
  isRecord(value) &&
  value.kind === kind &&
  typeof value.id === "string" &&
  (value.extensionId === undefined || typeof value.extensionId === "string");

const isResource = (value: unknown) =>
  isRecord(value) && typeof value.type === "string" && typeof value.id === "string";

const isResourceTarget = (target: Record<string, unknown>) => {
  if (!isResource(target.resource)) return false;
  if (target.input === undefined) return true;
  if (!isRecord(target.input)) return false;
  const strategy = target.input.strategy;
  return strategy === undefined || strategy === "persistent" || strategy === "replace-active";
};

const isViewTarget = (target: Record<string, unknown>) => {
  if (!isContributionRef(target.view, "view")) return false;
  if (target.input === undefined) return true;
  if (!isRecord(target.input)) return false;
  const strategy = target.input.strategy;
  return (
    strategy === undefined ||
    strategy === "persistent" ||
    strategy === "preview" ||
    strategy === "replace-active" ||
    strategy === "replace-invoking"
  );
};

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

const isPanelRef = (value: unknown) => {
  if (!isRecord(value)) return false;
  if (isContributionRef(value, "placement")) return true;
  return value.kind === "page-slot" && typeof value.id === "string" && isContributionRef(value.page, "page");
};

const isPanelTarget = (value: unknown) =>
  isRecord(value) &&
  value.kind === "panel" &&
  isPanelRef(value.panel) &&
  (value.resource === undefined || isResource(value.resource)) &&
  isOpenIntent(value.open);

const isItemTarget = (value: unknown): value is Exclude<ExtensionNavigationTarget, { kind: "compound" }> => {
  if (!isRecord(value)) return false;
  if (value.kind === "page") return isPageTarget(value);
  if (value.kind === "panel") return isPanelTarget(value);
  if (value.kind === "resource") return isResourceTarget(value);
  if (value.kind === "view") return isViewTarget(value);
  if (value.kind === "href") return typeof value.href === "string";
  return (
    value.kind === "command" &&
    isRecord(value.target) &&
    isContributionRef(value.target.command, "command") &&
    (value.target.params === undefined || isRecord(value.target.params))
  );
};

export const isExtensionNavigationTarget = (value: unknown): value is ExtensionNavigationTarget => {
  if (isItemTarget(value)) return true;
  if (!isRecord(value) || value.kind !== "compound" || !Array.isArray(value.targets) || value.targets.length === 0) {
    return false;
  }
  if (!value.targets.every(isItemTarget)) return false;
  const pageIndexes = value.targets.flatMap((target, index) => (target.kind === "page" ? [index] : []));
  return (
    pageIndexes.length === 0 ||
    (pageIndexes.length === 1 &&
      pageIndexes[0] === 0 &&
      value.targets.slice(1).every((target) => target.kind === "panel"))
  );
};

const toResourceInput = (
  strategy: "persistent" | "replace-active" | undefined,
  _sourcePlacement: ExtensionNavigationSourcePlacement | undefined,
) => {
  if (!strategy || strategy === "persistent") return {};
  return { replaceActive: true };
};

const toViewInput = (
  input: { strategy?: ExtensionPlacementStrategy } | undefined,
  sourcePlacement: ExtensionNavigationSourcePlacement | undefined,
) => {
  const strategy = input?.strategy;
  if (!strategy) return {};
  if (strategy === "persistent" || strategy === "preview" || strategy === "replace-active") {
    return { strategy: { kind: strategy } } as const;
  }
  if (!sourcePlacement) throw new Error("replace-invoking requires a live source placement.");
  return { strategy: { kind: "replace-panel", instanceId: sourcePlacement.instanceId } } as const;
};

const toCommandTarget = (
  target: Extract<ExtensionNavigationTarget, { kind: "command" }>,
  input: ToWorkbenchNavigationTargetInput,
) => {
  const override = input.commandTargetOf?.(target);
  if (override) return override;
  const command = target.target.command;
  const extensionId = command.extensionId ?? input.extensionId;
  const commandId =
    input.commandIdOf?.(command) ??
    (extensionId && extensionId !== "pstdio" ? `${extensionId}.command.${command.id}` : command.id);
  return { kind: "command", commandId, args: target.target.params } satisfies NavigationTargetCommand;
};

const viewIdOf = (target: Extract<ExtensionNavigationTarget, { kind: "view" }>, extensionId: string | undefined) => {
  const owner = target.view.extensionId ?? extensionId;
  // Host-published refs resolve to the host's registered id without owner prefixing,
  // the same rule commands follow in toCommandTarget.
  return owner && owner !== "pstdio" ? `${owner}.view.${target.view.id}` : target.view.id;
};

const withExtensionOwner = <Ref extends { extensionId?: string }>(ref: Ref, extensionId: string | undefined): Ref =>
  ref.extensionId !== undefined || extensionId === undefined ? ref : ({ ...ref, extensionId } as Ref);

const toPageTarget = (
  target: Extract<ExtensionNavigationTarget, { kind: "page" }>,
  extensionId: string | undefined,
): Extract<ExtensionNavigationTarget, { kind: "page" }> => ({
  ...target,
  page: withExtensionOwner(target.page, extensionId),
  ...(target.parent ? { parent: toPageTarget(target.parent, extensionId) } : {}),
});

const toPanelTarget = (
  target: Extract<ExtensionNavigationTarget, { kind: "panel" }>,
  extensionId: string | undefined,
): Extract<ExtensionNavigationTarget, { kind: "panel" }> => ({
  ...target,
  panel:
    target.panel.kind === "page-slot"
      ? { ...target.panel, page: withExtensionOwner(target.panel.page, extensionId) }
      : withExtensionOwner(target.panel, extensionId),
});

// The return type stays explicit: the compound branch recurses, and TypeScript
// cannot infer the return type of a self-referencing function.
export const toWorkbenchNavigationTarget = (
  target: ExtensionNavigationTarget,
  input: ToWorkbenchNavigationTargetInput = {},
): NavigationTarget => {
  if (target.kind === "resource") {
    // A section only means something with the caller's container context
    // (tree id, target node). Failing loudly beats silently dropping the
    // requested section.
    if (target.section && !input.resourceOf) {
      throw new Error("Resource targets with a section need a resourceOf translator that encodes the section.");
    }
    return {
      kind: "resource",
      resource: input.resourceOf ? input.resourceOf(target.resource, target) : toWorkbenchResource(target.resource),
      input: toResourceInput(target.input?.strategy, input.sourcePlacement),
    };
  }
  if (target.kind === "view") {
    return {
      kind: "view",
      viewId: viewIdOf(target, input.extensionId),
      input: toViewInput(target.input, input.sourcePlacement),
    };
  }
  if (target.kind === "command") return toCommandTarget(target, input);
  if (target.kind === "href") return target;
  if (target.kind === "page") return toPageTarget(target, input.extensionId);
  if (target.kind === "panel") return toPanelTarget(target, input.extensionId);
  return {
    kind: "compound",
    targets: target.targets.map(
      (item) => toWorkbenchNavigationTarget(item, input) as Exclude<NavigationTarget, { kind: "compound" }>,
    ),
  };
};

export const toWorkbenchNavigationTargetResult = (
  value: unknown,
  input: ToWorkbenchNavigationTargetInput = {},
): NavigationTarget | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!isExtensionNavigationTarget(value)) throw new Error("Renderer callback returned an invalid navigation target.");
  return toWorkbenchNavigationTarget(value, input);
};
