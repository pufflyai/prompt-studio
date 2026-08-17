import type { NavigationTarget, ResourceRef } from "../../core";
import { toWorkbenchResource } from "../host/workbench-extension-command";

interface ExtensionNavigationResourceTarget {
  kind: "resource";
  resource?: Parameters<typeof toWorkbenchResource>[0];
  input?: { strategy?: "persistent" | "replace-active" };
}

interface ExtensionNavigationPanelTarget {
  kind: "panel";
  panelId?: string;
}

interface ExtensionNavigationCommandTarget {
  kind: "command";
  command?: string | { id?: string };
  args?: unknown;
}

interface ExtensionNavigationCompoundTarget {
  kind: "compound";
  targets?: ExtensionNavigationItemTarget[];
}

type ExtensionNavigationItemTarget =
  | ExtensionNavigationResourceTarget
  | ExtensionNavigationPanelTarget
  | ExtensionNavigationCommandTarget;

type ExtensionNavigationTarget = ExtensionNavigationItemTarget | ExtensionNavigationCompoundTarget;
type ResolveNavigationResource = (resource: Parameters<typeof toWorkbenchResource>[0]) => ResourceRef;

const commandIdOf = (command: ExtensionNavigationCommandTarget["command"]) =>
  typeof command === "string" ? command : command?.id;

const isTarget = (value: unknown): value is ExtensionNavigationTarget =>
  Boolean(value && typeof value === "object" && typeof (value as { kind?: unknown }).kind === "string");

const defaultResolveResource: ResolveNavigationResource = (resource) => toWorkbenchResource(resource);

const toItem = (
  target: ExtensionNavigationItemTarget,
  resolveResource: ResolveNavigationResource,
): NavigationTarget | undefined => {
  if (target.kind === "resource" && target.resource) {
    return {
      kind: "resource",
      resource: resolveResource(target.resource),
      input: { replaceActive: target.input?.strategy === "replace-active" },
    };
  }
  if (target.kind === "panel" && target.panelId) return { kind: "panel", panelId: target.panelId };
  if (target.kind !== "command") return undefined;
  const commandId = commandIdOf(target.command);
  return commandId ? { kind: "command", commandId, args: target.args } : undefined;
};

export const toWorkbenchNavigationTarget = (
  value: unknown,
  resolveResource: ResolveNavigationResource = defaultResolveResource,
): NavigationTarget | undefined => {
  if (!isTarget(value)) return undefined;
  if (value.kind !== "compound") return toItem(value, resolveResource);
  const targets = (value.targets ?? []).flatMap((target) => {
    const item = toItem(target, resolveResource);
    return item && item.kind !== "compound" ? [item] : [];
  });
  return targets.length > 0 ? { kind: "compound", targets } : undefined;
};
