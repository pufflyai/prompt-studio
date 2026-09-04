import type { NavigationTarget as ExtensionNavigationTarget } from "@pstdio/sdk/extensions";
import type { NavigationTarget, NavigationTargetCommand } from "../../core";

export interface ToWorkbenchNavigationTargetInput {
  commandIdOf?(
    command: Extract<ExtensionNavigationTarget, { kind: "command" }>["target"]["command"],
  ): string | undefined;
  commandTargetOf?(target: Extract<ExtensionNavigationTarget, { kind: "command" }>): NavigationTargetCommand;
  extensionId?: string;
}

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

const isItemTarget = (value: unknown): value is Exclude<ExtensionNavigationTarget, { kind: "compound" }> => {
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

export const isExtensionNavigationTarget = (value: unknown): value is ExtensionNavigationTarget => {
  if (isItemTarget(value)) return true;
  if (!isRecord(value) || value.kind !== "compound" || !Array.isArray(value.targets) || value.targets.length === 0) {
    return false;
  }
  if (!value.targets.every(isItemTarget)) return false;
  const pageIndexes = value.targets.flatMap((target, index) => (target.kind === "page" ? [index] : []));
  return pageIndexes.length === 0 || (pageIndexes.length === 1 && pageIndexes[0] === 0);
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

// The return type stays explicit: the compound branch recurses, and TypeScript
// cannot infer the return type of a self-referencing function.
export const toWorkbenchNavigationTarget = (
  target: ExtensionNavigationTarget,
  input: ToWorkbenchNavigationTargetInput = {},
): NavigationTarget => {
  if (target.kind === "command") return toCommandTarget(target, input);
  if (target.kind === "href") return target;
  if (target.kind === "page") return toPageTarget(target, input.extensionId);
  if (target.kind === "panel") {
    return {
      ...target,
      panel:
        target.panel.kind === "page-slot"
          ? { ...target.panel, page: withExtensionOwner(target.panel.page, input.extensionId) }
          : withExtensionOwner(target.panel, input.extensionId),
    };
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
