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
  isRecord(value) && value.kind === kind && typeof value.id === "string";

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

const isItemTarget = (value: unknown): value is Exclude<ExtensionNavigationTarget, { kind: "compound" }> => {
  if (!isRecord(value)) return false;
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
  return (
    isRecord(value) &&
    value.kind === "compound" &&
    Array.isArray(value.targets) &&
    value.targets.length > 0 &&
    value.targets.every(isItemTarget)
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
  if (target.kind === "page" || target.kind === "panel") {
    throw new Error("Page and panel navigation targets require dashboard capability page.v1.");
  }
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
