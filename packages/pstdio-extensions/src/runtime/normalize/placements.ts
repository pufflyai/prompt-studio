import type { ContributionKind, ContributionRef, PlacementContribution, ResourceKindRef } from "@pstdio/sdk/extensions";
import { extensionPanelRegions } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimePlacementContribution } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator, RegistryIndex } from "./accumulator";
import { isRecord } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { normalizeNavigationAction } from "./navigation-action";
import { isPlacementPresentation, removedPlacementField } from "./placement-presentation";
import { registerPrivateHandler } from "./private-handlers";
import { normalizeContributionRef } from "./references";

const isValidItem = (item: PlacementContribution["item"]) => {
  if (!isRecord(item)) return false;
  if (item.kind === "view") return item.presence === "fixed" || item.presence === "open" || item.presence === "closed";
  if (item.kind !== "binding") return false;
  return item.cardinality === "one" || item.cardinality === "many";
};

const normalizePlacement = (input: {
  ext: NormalizedExtension;
  source: LoadedExtensionSource;
  runtime: Accumulator;
  index: RegistryIndex;
  contribution: PlacementContribution;
  placementId: string;
}): RuntimePlacementContribution => {
  const { tab: _tab, ...contribution } = input.contribution;
  const queryHandlerId = input.contribution.tab
    ? registerPrivateHandler({
        ext: input.ext,
        source: input.source,
        runtime: input.runtime,
        index: input.index,
        rendererId: input.placementId,
        rendererKind: "tab",
        rendererLocalId: input.contribution.id,
        operation: "query",
        handler: input.contribution.tab.query,
      })
    : undefined;
  const tab =
    input.contribution.tab && queryHandlerId
      ? { refreshEvents: input.contribution.tab.refreshEvents, queryHandlerId }
      : undefined;
  const normalizeRef = <Kind extends ContributionKind>(ref: ContributionRef<Kind>) =>
    normalizeContributionRef(input.ext, ref);
  return {
    ...contribution,
    ref: normalizeRef(input.contribution.ref),
    mode: normalizeRef(input.contribution.mode),
    ...(tab ? { tab } : {}),
    item:
      input.contribution.item.kind === "view"
        ? { ...input.contribution.item, view: normalizeRef(input.contribution.item.view) }
        : {
            ...input.contribution.item,
            view: normalizeRef(input.contribution.item.view),
            resourceKind: Array.isArray(input.contribution.item.resourceKind)
              ? input.contribution.item.resourceKind.map((kind) => normalizeRef(kind))
              : normalizeRef(input.contribution.item.resourceKind as ResourceKindRef),
            ...(input.contribution.item.add
              ? { add: normalizeNavigationAction(input.ext, input.contribution.item.add) }
              : {}),
          },
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
    const removed = removedPlacementField(contribution) ?? removedPlacementField(contribution.item);
    if (removed) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_placement",
          message: `Placement "${base.id}" uses removed field "${removed.field}"; ${removed.replacement}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: base.id, fieldPath: `placements.${contribution.id}.${removed.field}` },
        }),
      );
      continue;
    }
    const hasValidRegions =
      extensionPanelRegions.includes(contribution.region) &&
      (contribution.movableTo ?? []).every((region) => extensionPanelRegions.includes(region));
    if (!hasValidRegions || !isValidItem(contribution.item) || !isPlacementPresentation(contribution)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_placement",
          message: `Placement "${base.id}" must use an extension panel region and a valid item`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: base.id },
        }),
      );
      continue;
    }
    if (contribution.movableTo && !contribution.movableTo.includes(contribution.region)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_placement",
          message: `Placement "${base.id}" must include its initial region in movableTo`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    runtime.placements.push({
      ...base,
      contribution: normalizePlacement({ ext, source, runtime, index, contribution, placementId: base.id }),
    });
  }
};
