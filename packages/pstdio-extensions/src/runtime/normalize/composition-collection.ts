import type {
  ResourceHierarchyProvider,
  ResourceKindContribution,
  ResourcePanelContribution,
} from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import {
  contributionId,
  resolveContributionReference,
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

export const collectCompositionContributions = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.resourceKinds ?? {})) {
    if (!isRecord(contribution) || !isRecord(contribution.slots) || typeof contribution.surface !== "string") continue;
    runtime.resourceKinds.push({
      ...recordBase(ext, source, localId),
      // A resource kind keeps the plain name it was declared with. See
      // `resolveResourceKindReference` for why the host must not namespace it.
      id: localId,
      contribution: contribution as unknown as ResourceKindContribution,
    });
  }

  for (const [localId, contribution] of Object.entries(source.definition.resourcePanels ?? {})) {
    if (
      !isRecord(contribution) ||
      typeof contribution.resourceKind !== "string" ||
      typeof contribution.panel !== "string" ||
      typeof contribution.slot !== "string"
    ) {
      continue;
    }
    runtime.resourcePanels.push({
      ...recordBase(ext, source, localId),
      // Kept as written: resource kinds are resolved once every extension is
      // collected, so a cross-extension edge does not depend on source order.
      resourceKindId: contribution.resourceKind,
      panelId: resolveContributionReference(ext, contribution.panel),
      slotId: contribution.slot,
      contribution: contribution as unknown as ResourcePanelContribution,
    });
  }

  for (const [localId, provider] of Object.entries(source.definition.resourceHierarchyProviders ?? {})) {
    if (!isRecord(provider) || typeof provider.resourceKind !== "string" || typeof provider.parent !== "function") {
      continue;
    }
    runtime.resourceHierarchyProviders.push({
      ...recordBase(ext, source, localId),
      resourceKindId: provider.resourceKind,
      provider: provider as unknown as ResourceHierarchyProvider,
    });
  }
};

// Resource kind references resolve after every extension is collected, so a
// cross-extension reference is independent of source order.
export const resolveCompositionResourceKindReferences = (runtime: Accumulator) => {
  const references = resourceKindReferences(runtime.resourceKinds);
  runtime.resourcePanels = runtime.resourcePanels.map((edge) => ({
    ...edge,
    resourceKindId: resolveResourceKindReference(edge.resourceKindId, references),
  }));
  runtime.resourceHierarchyProviders = runtime.resourceHierarchyProviders.map((provider) => ({
    ...provider,
    resourceKindId: resolveResourceKindReference(provider.resourceKindId, references),
  }));
  return references;
};
