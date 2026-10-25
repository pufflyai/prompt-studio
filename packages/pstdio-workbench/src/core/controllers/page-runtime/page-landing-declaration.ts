import type { PlacementRef } from "@pstdio/sdk/extensions";
import type { WorkbenchModePlacementRegistry } from "../../registries/modes/mode-placement-registry";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";

export const independentPageLanding = (page: WorkbenchPageContribution) => {
  const landing = page.main.kind === "panels" ? page.main.landing : undefined;
  return landing && typeof landing !== "string" ? landing : undefined;
};
const samePlacement = (left: PlacementRef, right: PlacementRef | undefined) =>
  left.id === right?.id && left.extensionId === right.extensionId;
const sameResources = (left: WorkbenchPageContribution, right: WorkbenchPageContribution) => {
  if (!left.resource || !right.resource) return !left.resource && !right.resource;
  return left.resource.kinds.some((kind) =>
    resourceMatchesConstraint(right.resource!, { type: kind.id, id: "", extensionId: kind.extensionId }),
  );
};

export const validatePageLandingDeclaration = (
  page: WorkbenchPageContribution,
  registry: WorkbenchModePlacementRegistry,
  pages: readonly WorkbenchPageContribution[],
) => {
  const landing = independentPageLanding(page);
  if (!landing) return;
  const placement = registry.getPlacement(landing);
  if (!placement || placement.modeId !== page.modeId)
    throw new Error(`Page "${page.id}" requires a landing placement in its mode`);
  if (placement.item.kind === "binding") {
    const binding = placement.item.binding;
    if (
      !page.resource ||
      binding.cardinality !== "many" ||
      placement.region !== "main" ||
      !page.resource.kinds.every((kind) =>
        resourceMatchesConstraint(binding, { type: kind.id, id: "", extensionId: kind.extensionId }),
      )
    )
      throw new Error(`Page "${page.id}" requires a compatible many-resource Main landing viewer`);
  }
  if (
    pages.some(
      (candidate) =>
        candidate.id !== page.id &&
        candidate.modeId === page.modeId &&
        samePlacement(landing, independentPageLanding(candidate)) &&
        sameResources(page, candidate),
    )
  )
    throw new Error(`Page "${page.id}" must have an unambiguous landing route`);
};
