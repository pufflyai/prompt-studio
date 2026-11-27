export const documentScope = (key: string) => JSON.parse(key) as [string, string, string | null, string];
export const wireDocumentId = (key: string) => documentScope(key)[3];

export const documentKey = (
  scope: { accountId: string; projectId: string; spaceOwner: string | null },
  documentId: string,
) =>
  JSON.stringify([
    scope.accountId,
    scope.projectId,
    scope.spaceOwner,
    documentId.startsWith("~") ? documentId : `~${documentId}`,
  ]);

export const uniqueDocument = <T>(entries: Iterable<readonly [string, T]>, documentId: string) => {
  const id = documentId.startsWith("~") ? documentId : `~${documentId}`;
  const matches = [...entries].filter(([key]) => wireDocumentId(key) === id);
  if (matches.length > 1) throw new Error(`Expected one controlled document for ${id}, found ${matches.length}`);
  return matches[0]?.[1];
};

export const uniqueDocumentKey = (keys: Iterable<string>, documentId: string) => {
  const key = uniqueDocument(
    [...keys].map((value) => [value, value] as const),
    documentId,
  );
  if (!key) throw new Error(`Controlled document ${documentId} was not found`);
  return key;
};
