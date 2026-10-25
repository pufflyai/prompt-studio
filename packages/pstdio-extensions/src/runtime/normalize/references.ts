import type { CommandRef, ContributionKind, ContributionRef, EventRef, WhenExpression } from "@pstdio/sdk/extensions";
import { contributionRefId } from "@pstdio/sdk/extensions";
import { resolveEventReferenceId } from "pstdio-api-contracts";
import type { NormalizedExtension } from "../../types/runtime";

export const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

export const normalizeContributionRef = <Kind extends ContributionKind>(
  ext: NormalizedExtension,
  ref: ContributionRef<Kind>,
) => ({ ...ref, extensionId: ref.extensionId ?? ext.id });

export const resolveCommandRef = (ext: NormalizedExtension, ref: CommandRef) => contributionRefId(ref, ext.id);

export const resolveEventRef = (ext: NormalizedExtension, ref: EventRef) => resolveEventReferenceId(ref, ext.id);

export const resourceKindReferences = (
  kinds: readonly { id: string; localId?: string; name: string; extensionId?: string }[],
) => {
  const references = new Map<string, string>();
  const aliases = new Map<string, Set<string>>();
  for (const kind of kinds) {
    const localId = kind.localId ?? kind.id;
    references.set(kind.id, kind.id);
    if (kind.extensionId) {
      references.set(`${kind.extensionId}.${localId}`, kind.id);
      references.set(contributionRefId({ extensionId: kind.extensionId, kind: "resource-kind", id: localId }), kind.id);
    }
    for (const alias of [localId, `${kind.name}.${localId}`]) {
      const owners = aliases.get(alias) ?? new Set<string>();
      owners.add(kind.id);
      aliases.set(alias, owners);
    }
  }
  for (const [alias, owners] of aliases) {
    if (owners.size === 1) references.set(alias, [...owners][0]!);
    else references.delete(alias);
  }
  return references;
};

export const resolveResourceKindReference = (reference: string, references: ReadonlyMap<string, string>) => {
  const resolved = references.get(reference);
  if (resolved && resolved !== reference && !reference.includes(".resource-kind.")) {
    console.warn(`Deprecated resource kind "${reference}"; use "${resolved}".`);
  }
  return resolved ?? reference;
};

const refs = <Kind extends ContributionKind>(
  value: ContributionRef<Kind> | readonly ContributionRef<Kind>[] | undefined,
) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const oneOrMany = (values: readonly string[]) => {
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : [...values];
};

export const serializeWhenExpression = (when: WhenExpression | undefined, extensionId: string) => {
  if (!when) return undefined;
  const mode = oneOrMany(refs(when.mode).map((ref) => contributionRefId(ref, extensionId)));
  const viewId = oneOrMany(refs(when.view).map((ref) => contributionRefId(ref, extensionId)));
  const resourceType = when.resourceType?.map((ref) => {
    const owner = ref.extensionId ?? extensionId;
    return owner === "pstdio" ? ref.id : `${owner}.${ref.id}`;
  });
  return {
    ...(mode ? { mode } : {}),
    ...(viewId ? { viewId } : {}),
    ...(resourceType?.length ? { resourceType } : {}),
    ...(when.source ? { source: [...when.source] } : {}),
    ...(when.metadata ? { metadata: when.metadata } : {}),
  };
};
