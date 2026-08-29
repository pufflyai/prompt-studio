import type { CommandRef, ContributionKind, ContributionRef, RendererEventReference } from "@pstdio/sdk/extensions";
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
