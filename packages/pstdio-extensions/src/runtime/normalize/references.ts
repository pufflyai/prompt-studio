import type { NormalizedExtension } from "../../types/runtime";

export const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

export const resolveContributionReference = (ext: NormalizedExtension, reference: string) =>
  reference.includes(".") ? reference : contributionId(ext, reference);
