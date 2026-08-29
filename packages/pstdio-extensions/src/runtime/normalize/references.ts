import type { CommandRef, ContributionKind, ContributionRef, EventRef, WhenExpression } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";

export const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

// The host publishes refs with extensionId "pstdio" (builtin-refs.ts). Their ids are the
// host's registered ids and must never be owner-prefixed, for any contribution kind.
export const hostExtensionId = "pstdio";

export const normalizedContributionId = (extensionId: string, kind: ContributionKind, localId: string) =>
  `${extensionId}.${kind}.${localId}`;

export const normalizeContributionRef = <Kind extends ContributionKind>(
  ext: NormalizedExtension,
  ref: ContributionRef<Kind>,
) => ({ ...ref, extensionId: ref.extensionId ?? ext.id });

export const resolveContributionRefId = <Kind extends ContributionKind>(
  ownerExtensionId: string,
  ref: ContributionRef<Kind>,
) => {
  const extensionId = ref.extensionId ?? ownerExtensionId;
  return extensionId === hostExtensionId ? ref.id : normalizedContributionId(extensionId, ref.kind, ref.id);
};

export const resolveCommandRef = (ext: NormalizedExtension, ref: CommandRef) => resolveContributionRefId(ext.id, ref);

export const resolveEventRef = (ext: NormalizedExtension, ref: EventRef) => {
  const extensionId = ref.extensionId ?? ext.id;
  const lifecycleMatch = /^(command\.(?:requested|started|completed|rejected|failed):)(.+)$/.exec(ref.id);
  if (lifecycleMatch) {
    const command = { kind: "command", id: lifecycleMatch[2]!, extensionId } as const;
    return `${lifecycleMatch[1]}${resolveContributionRefId(extensionId, command)}`;
  }
  return extensionId === hostExtensionId ? ref.id : `${extensionId}.event.${ref.id}`;
};

// A resource kind's id is the plain name its extension declares, unlike a panel or mode
// id. That same string is the resource type in every payload crossing the extension
// boundary, in persisted resource URIs, and in persisted session anchors, so the host
// must not rewrite it. A reference may name a kind bare or namespaced as
// `<extension>.<kind>`; the namespaced form records who owns the kind and resolves to
// the same declared id. Anything else — a host kind, or an extension that is not
// installed — stays exactly as written.
export const resourceKindReferences = (kinds: readonly { id: string; name: string; extensionId?: string }[]) =>
  new Map(
    kinds.flatMap((kind) => [
      [kind.id, kind.id],
      [`${kind.name}.${kind.id}`, kind.id],
      ...(kind.extensionId ? [[`${kind.extensionId}.${kind.id}`, kind.id] as const] : []),
      ...(kind.extensionId
        ? [[normalizedContributionId(kind.extensionId, "resource-kind", kind.id), kind.id] as const]
        : []),
    ]),
  );

export const resolveResourceKindReference = (reference: string, references: ReadonlyMap<string, string>) =>
  references.get(reference) ?? reference;

const refs = <Kind extends ContributionKind>(
  value: ContributionRef<Kind> | readonly ContributionRef<Kind>[] | undefined,
) => (value ? (Array.isArray(value) ? value : [value]) : []);

const oneOrMany = (values: readonly string[]) =>
  values.length === 0 ? undefined : values.length === 1 ? values[0] : [...values];

export const serializeWhenExpression = (
  when: WhenExpression | undefined,
  extensionId: string,
  resourceKinds: ReadonlyMap<string, string> = new Map(),
) => {
  if (!when) return undefined;
  const mode = oneOrMany(refs(when.mode).map((ref) => resolveContributionRefId(extensionId, ref)));
  const viewId = oneOrMany(refs(when.view).map((ref) => resolveContributionRefId(extensionId, ref)));
  const resourceType = when.resourceType?.map((ref) =>
    resolveResourceKindReference(resolveContributionRefId(extensionId, ref), resourceKinds),
  );
  return {
    ...(mode ? { mode } : {}),
    ...(viewId ? { viewId } : {}),
    ...(resourceType?.length ? { resourceType } : {}),
    ...(when.source ? { source: [...when.source] } : {}),
    ...(when.metadata ? { metadata: when.metadata } : {}),
  };
};
