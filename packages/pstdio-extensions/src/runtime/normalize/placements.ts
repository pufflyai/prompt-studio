import type { ContributionKind, ContributionRef, PlacementContribution } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimePlacementContribution } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator, RegistryIndex } from "./accumulator";
import { placementDeclarationSchema } from "./composition-declarations";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { validateDeclaration } from "./declaration-diagnostic";
import { normalizePlacementTab } from "./placement-tab";
import { normalizeContributionRef } from "./references";
import { normalizePlacementItem } from "./resource-binding";

const normalizePlacement = (input: {
  ext: NormalizedExtension;
  source: LoadedExtensionSource;
  runtime: Accumulator;
  index: RegistryIndex;
  contribution: PlacementContribution;
  placementId: string;
}): RuntimePlacementContribution => {
  const { tab: _tab, ...contribution } = input.contribution;
  const tab = normalizePlacementTab({ ...input, id: input.placementId, tab: input.contribution.tab });
  const normalizeRef = <Kind extends ContributionKind>(ref: ContributionRef<Kind>) =>
    normalizeContributionRef(input.ext, ref);
  return {
    ...contribution,
    ref: normalizeRef(input.contribution.ref),
    mode: normalizeRef(input.contribution.mode),
    ...(tab ? { tab } : {}),
    item: normalizePlacementItem(input.ext, input.contribution.item),
  };
};

export const registerPlacements = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "placement",
    contributions: contributionArray<PlacementContribution>(source.definition.placements),
  });
  for (const contribution of contributions) {
    const base = contributionRecordBase(ext, source, "placement", contribution.id);
    if (
      !validateDeclaration({
        ext,
        source,
        runtime,
        kind: "placement",
        contribution,
        schema: placementDeclarationSchema,
      })
    )
      continue;
    runtime.placements.push({
      ...base,
      contribution: normalizePlacement({ ext, source, runtime, index, contribution, placementId: base.id }),
    });
  }
};
