import type { NormalizedExtension } from "../../types/runtime";

export const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

export const resolveContributionReference = (ext: NormalizedExtension, reference: string) =>
  reference.includes(".") ? reference : contributionId(ext, reference);

// A resource kind's id is the plain name its extension declares, unlike a panel or mode
// id. That same string is the resource type in every payload crossing the extension
// boundary, in persisted resource URIs, and in persisted session anchors, so the host
// must not rewrite it. A reference may name a kind bare or namespaced as
// `<extension>.<kind>`; the namespaced form records who owns the kind and resolves to
// the same declared id. Anything else — a host kind, or an extension that is not
// installed — stays exactly as written.
export const resourceKindReferences = (kinds: readonly { id: string; name: string }[]) =>
  new Map(
    kinds.flatMap((kind) => [
      [kind.id, kind.id],
      [`${kind.name}.${kind.id}`, kind.id],
    ]),
  );

export const resolveResourceKindReference = (reference: string, references: ReadonlyMap<string, string>) =>
  references.get(reference) ?? reference;
