import type {
  ResourceHierarchyProvider,
  ResourceKindDefinition,
  ResourceViewContribution,
} from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import {
  contributionId,
  normalizeContributionRef,
  normalizedContributionId,
  resolveResourceKindReference,
  resourceKindReferences,
} from "./references";

const recordBase = (ext: NormalizedExtension, source: LoadedExtensionSource, localId: string) => ({
  id: contributionId(ext, localId),
  localId,
  extensionId: ext.id,
  name: ext.name,
  sourcePath: source.sourcePath,
});

const normalizeResourceSlots = (value: unknown) =>
  Array.isArray(value)
    ? Object.fromEntries(
        value.flatMap((slot) =>
          isRecord(slot) && typeof slot.id === "string" && typeof slot.cardinality === "string"
            ? [[slot.id, { cardinality: slot.cardinality, external: slot.access === "public" }]]
            : [],
        ),
      )
    : (value ?? {});

const normalizeResourceMenuSlots = (value: unknown) =>
  Array.isArray(value)
    ? Object.fromEntries(
        value.flatMap((slot) =>
          isRecord(slot) && typeof slot.id === "string" && typeof slot.placement === "string"
            ? [
                [
                  slot.id,
                  {
                    placement: slot.placement,
                    label: slot.label,
                    external: slot.access === "public",
                    order: slot.order,
                  },
                ],
              ]
            : [],
        ),
      )
    : (value ?? {});

export const collectCompositionContributions = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  const resourceKinds = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "resource-kind",
    contributions: contributionArray<ResourceKindDefinition>(source.definition.resourceKinds),
  });
  for (const contribution of resourceKinds) {
    const localId = contribution.id;
    if (!isRecord(contribution) || typeof contribution.surface !== "string") continue;
    const slots = normalizeResourceSlots(contribution.slots);
    if (!isRecord(slots)) continue;
    const menuSlots = normalizeResourceMenuSlots(contribution.menuSlots);
    if (!isRecord(menuSlots)) continue;
    runtime.resourceKinds.push({
      ...recordBase(ext, source, localId),
      // A resource kind keeps the plain name it was declared with. See
      // `resolveResourceKindReference` for why the host must not namespace it.
      id: localId,
      contribution: {
        ...contribution,
        slots,
        menuSlots,
        ...(isRecord(contribution.ref)
          ? { ref: normalizeContributionRef(ext, contribution.ref as unknown as ResourceKindDefinition["ref"]) }
          : {}),
      } as (typeof runtime.resourceKinds)[number]["contribution"],
    });
  }

  const resourceViews = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "resource-view",
    contributions: contributionArray<ResourceViewContribution>(source.definition.resourceViews),
  });
  for (const contribution of resourceViews) {
    if (
      !isRecord(contribution) ||
      typeof contribution.id !== "string" ||
      !isRecord(contribution.resourceKind) ||
      !isRecord(contribution.slot) ||
      !isRecord(contribution.view)
    ) {
      continue;
    }
    const resourceKind = normalizeContributionRef(ext, contribution.resourceKind as never);
    const view = normalizeContributionRef(ext, contribution.view as never);
    runtime.resourceViews.push({
      ...recordBase(ext, source, contribution.id),
      id: normalizedContributionId(ext.id, "resource-view", contribution.id),
      resourceKindId: `${resourceKind.extensionId}.${resourceKind.id}`,
      viewId: normalizedContributionId(view.extensionId, "view", view.id),
      slotId: String(contribution.slot.id),
      contribution: {
        ...(contribution as unknown as ResourceViewContribution),
        ref: normalizeContributionRef(ext, contribution.ref as never),
        resourceKind,
        slot: { ...contribution.slot, resourceKind },
        view,
      } as ResourceViewContribution,
    });
  }

  const providers = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "resource-hierarchy-provider",
    contributions: contributionArray<ResourceHierarchyProvider>(source.definition.resourceHierarchyProviders),
  });
  for (const provider of providers) {
    if (!isRecord(provider.resourceKind) || typeof provider.parent !== "function") continue;
    const resourceKind = normalizeContributionRef(ext, provider.resourceKind);
    runtime.resourceHierarchyProviders.push({
      ...contributionRecordBase(ext, source, "resource-hierarchy-provider", provider.id),
      resourceKindId: `${resourceKind.extensionId}.${resourceKind.id}`,
      provider: { ...provider, ref: normalizeContributionRef(ext, provider.ref), resourceKind },
    });
  }
};

// Resource kind references resolve after every extension is collected, so a
// cross-extension reference is independent of source order.
export const resolveCompositionResourceKindReferences = (runtime: Accumulator) => {
  const references = resourceKindReferences(runtime.resourceKinds);
  runtime.resourceViews = runtime.resourceViews.map((edge) => ({
    ...edge,
    resourceKindId: resolveResourceKindReference(edge.resourceKindId, references),
  }));
  runtime.resourceHierarchyProviders = runtime.resourceHierarchyProviders.map((provider) => ({
    ...provider,
    resourceKindId: resolveResourceKindReference(provider.resourceKindId, references),
  }));
  return references;
};
