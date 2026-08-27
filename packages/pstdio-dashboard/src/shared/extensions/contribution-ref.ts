export const toWorkbenchContributionId = (ref: { extensionId: string; kind: string; id: string }) =>
  ref.extensionId === "pstdio" ? ref.id : `${ref.extensionId}.${ref.kind}.${ref.id}`;
