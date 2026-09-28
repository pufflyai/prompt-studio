import {
  type NavigationTarget as ExtensionNavigationTarget,
  isNavigationTarget,
  qualifyNavigationTarget,
} from "@pstdio/sdk/extensions";
import type { NavigationTarget, NavigationTargetCommand } from "../../core";

export interface ToWorkbenchNavigationTargetInput {
  commandIdOf?(
    command: Extract<ExtensionNavigationTarget, { kind: "command" }>["target"]["command"],
  ): string | undefined;
  commandTargetOf?(target: Extract<ExtensionNavigationTarget, { kind: "command" }>): NavigationTargetCommand;
  extensionId?: string;
  projectId?: string;
}

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

// The return type stays explicit: the compound branch recurses, and TypeScript
// cannot infer the return type of a self-referencing function.
type NavigationOperation = Extract<ExtensionNavigationTarget, { kind: "page" | "panel" }>;
export function toWorkbenchNavigationTarget(
  target: NavigationOperation,
  input?: ToWorkbenchNavigationTargetInput,
): NavigationOperation;
export function toWorkbenchNavigationTarget(
  target: ExtensionNavigationTarget,
  input?: ToWorkbenchNavigationTargetInput,
): NavigationTarget;
export function toWorkbenchNavigationTarget(
  target: ExtensionNavigationTarget,
  input: ToWorkbenchNavigationTargetInput = {},
): NavigationTarget {
  if (!isNavigationTarget(target)) throw new Error("Invalid navigation target.");
  if (input.extensionId) target = qualifyNavigationTarget(target, input.extensionId, input.projectId);
  if (target.kind === "command") return toCommandTarget(target, input);
  if (target.kind === "href") return target;
  if (target.kind === "page") return target;
  if (target.kind === "panel") return target;
  return {
    kind: "compound",
    targets: target.targets.map((item) => toWorkbenchNavigationTarget(item, input)),
  };
}
