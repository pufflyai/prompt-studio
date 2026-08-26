import type { ContributionKind } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator } from "./accumulator";
import { normalizedContributionId } from "./references";

export const contributionArray = <T extends { id: string }>(input: unknown): readonly T[] =>
  Array.isArray(input) ? (input as readonly T[]) : [];

export const contributionRecordBase = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  kind: ContributionKind,
  localId: string,
) => ({
  id: normalizedContributionId(ext.id, kind, localId),
  localId,
  extensionId: ext.id,
  name: ext.name,
  sourcePath: source.sourcePath,
});

export const uniqueContributions = <T extends { id: string }>(input: {
  ext: NormalizedExtension;
  source: LoadedExtensionSource;
  runtime: Accumulator;
  kind: ContributionKind;
  contributions: readonly T[];
}) => {
  const seen = new Set<string>();
  return input.contributions.filter((contribution) => {
    if (!contribution.id.trim()) return false;
    if (seen.has(contribution.id)) {
      input.runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_contribution_id",
          message: `Extension "${input.ext.id}" declares ${input.kind} id "${contribution.id}" more than once`,
          extensionId: input.ext.id,
          sourcePath: input.source.sourcePath,
          metadata: { kind: input.kind, localId: contribution.id },
        }),
      );
      return false;
    }
    seen.add(contribution.id);
    return true;
  });
};
