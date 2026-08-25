import type { ExtensionNavigationTarget, ExtensionPlacementStrategy } from "@pstdio/sdk/extensions";
import type { NavigationTarget, NavigationTargetCommand, ResourceRef, WorkbenchRegion } from "../../core";
import { toWorkbenchResource } from "./workbench-extension-command";

export interface ExtensionNavigationSourcePlacement {
  instanceId: string;
}

export interface ToWorkbenchNavigationTargetInput {
  commandIdOf?(command: unknown): string | undefined;
  commandTargetOf?(target: Extract<ExtensionNavigationTarget, { kind: "command" }>): NavigationTargetCommand;
  resourceOf?(
    resource: Parameters<typeof toWorkbenchResource>[0],
    target: Extract<ExtensionNavigationTarget, { kind: "resource" }>,
  ): ResourceRef;
  sourcePlacement?: ExtensionNavigationSourcePlacement;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isCommand = (value: unknown) => typeof value === "string" || (isRecord(value) && typeof value.id === "string");

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
  if (typeof target.viewId !== "string") return false;
  if (target.input === undefined) return true;
  if (!isRecord(target.input)) return false;
  const strategy = target.input.strategy;
  const region = target.input.region;
  return (
    (region === undefined || typeof region === "string") &&
    (strategy === undefined ||
      strategy === "persistent" ||
      strategy === "preview" ||
      strategy === "replace-active" ||
      strategy === "replace-invoking")
  );
};

const isItemTarget = (value: unknown): value is Exclude<ExtensionNavigationTarget, { kind: "compound" }> => {
  if (!isRecord(value)) return false;
  if (value.kind === "resource") return isResourceTarget(value);
  if (value.kind === "view") return isViewTarget(value);
  return value.kind === "command" && isCommand(value.command) && (value.params === undefined || isRecord(value.params));
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
  input: { region?: string; strategy?: ExtensionPlacementStrategy } | undefined,
  sourcePlacement: ExtensionNavigationSourcePlacement | undefined,
) => {
  const strategy = input?.strategy;
  const shared = input?.region ? { region: input.region as WorkbenchRegion } : {};
  if (!strategy) return shared;
  if (strategy === "persistent" || strategy === "preview" || strategy === "replace-active") {
    return { ...shared, strategy: { kind: strategy } } as const;
  }
  if (!sourcePlacement) throw new Error("replace-invoking requires a live source placement.");
  return { ...shared, strategy: { kind: "replace-panel", instanceId: sourcePlacement.instanceId } } as const;
};

const toCommandTarget = (
  target: Extract<ExtensionNavigationTarget, { kind: "command" }>,
  input: ToWorkbenchNavigationTargetInput,
) => {
  const override = input.commandTargetOf?.(target);
  if (override) return override;
  const commandId =
    input.commandIdOf?.(target.command) ?? (typeof target.command === "string" ? target.command : target.command.id);
  return { kind: "command", commandId, args: target.params } satisfies NavigationTargetCommand;
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
    return { kind: "view", viewId: target.viewId, input: toViewInput(target.input, input.sourcePlacement) };
  }
  if (target.kind === "command") return toCommandTarget(target, input);
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
