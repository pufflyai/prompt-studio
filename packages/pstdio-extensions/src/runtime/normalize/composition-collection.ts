import type { PageContribution, ResourceHierarchyProvider, ResourceKindDefinition } from "@pstdio/sdk/extensions";
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

const isResourceKindContribution = (contribution: unknown): contribution is ResourceKindDefinition =>
  isRecord(contribution) &&
  isRecord(contribution.ref) &&
  (contribution.ref as { kind?: unknown }).kind === "resource-kind";

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
    if (!isResourceKindContribution(contribution)) continue;
    const menuSlots = normalizeResourceMenuSlots(contribution.menuSlots);
    if (!isRecord(menuSlots)) continue;
    runtime.resourceKinds.push({
      ...recordBase(ext, source, localId),
      // A resource kind keeps the plain name it was declared with. See
      // `resolveResourceKindReference` for why the host must not namespace it.
      id: localId,
      contribution: {
        ...contribution,
        menuSlots,
        ref: normalizeContributionRef(ext, contribution.ref),
      } as (typeof runtime.resourceKinds)[number]["contribution"],
    });
  }

  const pages = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "page",
    contributions: contributionArray<PageContribution>(source.definition.pages),
  });
  for (const contribution of pages) {
    if (!isRecord(contribution) || typeof contribution.id !== "string" || !Array.isArray(contribution.slots)) {
      continue;
    }
    runtime.pages.push({
      ...recordBase(ext, source, contribution.id),
      id: normalizedContributionId(ext.id, "page", contribution.id),
      contribution: {
        ...contribution,
        ref: normalizeContributionRef(ext, contribution.ref),
        slots: contribution.slots.map((slot) =>
          isRecord(slot) && isRecord(slot.view)
            ? { ...slot, view: normalizeContributionRef(ext, slot.view as never) }
            : slot,
        ),
        bindings: (contribution.bindings ?? []).map((binding) => ({
          ...binding,
          resourceKind: normalizeContributionRef(ext, binding.resourceKind),
          view: normalizeContributionRef(ext, binding.view),
        })),
      } as PageContribution,
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
  runtime.resourceHierarchyProviders = runtime.resourceHierarchyProviders.map((provider) => ({
    ...provider,
    resourceKindId: resolveResourceKindReference(provider.resourceKindId, references),
  }));
  return references;
};
