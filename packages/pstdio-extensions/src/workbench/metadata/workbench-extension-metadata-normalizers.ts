import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type {
  CommandRef,
  ContributionKind,
  ContributionRef,
  NavigationTarget,
  RendererEventReference,
} from "@pstdio/sdk/extensions";
import { resolveContributionRefId } from "../../runtime/normalize/references";

export const normalizedRef = <Kind extends ContributionKind>(
  ref: ContributionRef<Kind>,
  extensionId: string,
): ContributionRef<Kind> & { extensionId: string } => ({ ...ref, extensionId: ref.extensionId ?? extensionId });

export const commandRef = (ref: CommandRef, extensionId: string) => normalizedRef(ref, extensionId);

const eventId = (ref: RendererEventReference, extensionId: string) => {
  if (typeof ref === "string") return ref;
  const owner = ref.extensionId ?? extensionId;
  const lifecycle = /^(command\.(?:requested|started|completed|rejected|failed):)(.+)$/.exec(ref.id);
  if (lifecycle) {
    return `${lifecycle[1]}${resolveContributionRefId(owner, { kind: "command", id: lifecycle[2]! })}`;
  }
  return owner === "pstdio" ? ref.id : `${owner}.event.${ref.id}`;
};

export const refreshEventIds = (events: readonly RendererEventReference[] | undefined, extensionId: string) => {
  const ids = [...new Set((events ?? []).map((event) => eventId(event, extensionId)))];
  return ids.length > 0 ? ids : undefined;
};

export type MetadataNavigationTarget = WorkbenchExtensionMetadata["navigationItems"][number]["action"];

export const normalizeTarget = (target: NavigationTarget, extensionId: string): MetadataNavigationTarget => {
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
      targets: target.targets.map(
        (item) => normalizeTarget(item, extensionId) as Exclude<MetadataNavigationTarget, { kind: "compound" }>,
      ),
    };
  }
  return target;
};
