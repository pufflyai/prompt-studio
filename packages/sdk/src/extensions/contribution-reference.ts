// The host publishes its own contributions with extensionId "pstdio". Their ids are the
// host's registered ids and are never owner-prefixed, for any contribution kind.
const HOST_EXTENSION_ID = "pstdio";

/**
 * Resolve a contribution ref to its registered id. Host refs keep their id; every other
 * ref becomes `${extensionId}.${kind}.${id}`. A ref without an extension id belongs to
 * `ownerExtensionId`, or to the host when there is no owner.
 */
export const contributionRefId = (
  ref: { extensionId?: string; kind: string; id: string },
  ownerExtensionId?: string,
) => {
  const extensionId = ref.extensionId ?? ownerExtensionId;
  if (!extensionId || extensionId === HOST_EXTENSION_ID) return ref.id;
  return `${extensionId}.${ref.kind}.${ref.id}`;
};

/** Resolve a command ref to its registered command id, with the same rules as `contributionRefId`. */
export const commandRefId = (ref: { extensionId?: string; id: string }, ownerExtensionId?: string) =>
  contributionRefId({ ...ref, kind: "command" }, ownerExtensionId);
