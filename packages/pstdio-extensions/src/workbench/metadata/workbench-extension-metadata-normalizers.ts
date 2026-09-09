import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type {
  CommandRef,
  ContributionKind,
  ContributionRef,
  NavigationTarget,
  RendererEventReference,
} from "@pstdio/sdk/extensions";
import { resolveEventReferenceId } from "@pstdio/sdk/extensions";

export const normalizedRef = <Kind extends ContributionKind>(
  ref: ContributionRef<Kind>,
  extensionId: string,
): ContributionRef<Kind> & { extensionId: string } => ({ ...ref, extensionId: ref.extensionId ?? extensionId });

export const commandRef = (ref: CommandRef, extensionId: string) => normalizedRef(ref, extensionId);

export const refreshEventIds = (events: readonly RendererEventReference[] | undefined, extensionId: string) => {
  const ids = [...new Set((events ?? []).map((event) => resolveEventReferenceId(event, extensionId)))];
  return ids.length > 0 ? ids : undefined;
};

export type MetadataNavigationTarget = WorkbenchExtensionMetadata["navigationItems"][number]["action"];

type NavigationOperation = Extract<NavigationTarget, { kind: "page" | "panel" }>;
type MetadataOperation = Extract<MetadataNavigationTarget, { kind: "page" | "panel" }>;
export function normalizeTarget(target: NavigationOperation, extensionId: string): MetadataOperation;
export function normalizeTarget(target: NavigationTarget, extensionId: string): MetadataNavigationTarget;
export function normalizeTarget(target: NavigationTarget, extensionId: string): MetadataNavigationTarget {
  if (target.kind === "page") {
    return {
      ...target,
      page: normalizedRef(target.page, extensionId),
      parent: target.parent ? (normalizeTarget(target.parent, extensionId) as typeof target.parent) : undefined,
    } as MetadataNavigationTarget;
  }
  if (target.kind === "panel") {
    return {
      ...target,
      panel:
        target.panel.kind === "page-slot"
          ? { ...target.panel, page: normalizedRef(target.panel.page, extensionId) }
          : normalizedRef(target.panel, extensionId),
    } as MetadataNavigationTarget;
  }
  if (target.kind === "command") {
    return { ...target, target: { ...target.target, command: commandRef(target.target.command, extensionId) } };
  }
  if (target.kind === "compound") {
    return {
      ...target,
      targets: target.targets.map((item) => normalizeTarget(item, extensionId)),
    };
  }
  return target;
}
