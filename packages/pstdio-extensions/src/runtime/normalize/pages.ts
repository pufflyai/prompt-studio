import type { PageContribution, PageMain, PageSlot } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimePageMain, RuntimePageSlot } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator, RegistryIndex } from "./accumulator";
import { pageDeclarationSchema } from "./composition-declarations";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { validateDeclaration } from "./declaration-diagnostic";
import { normalizePlacementTab } from "./placement-tab";
import { normalizeContributionRef } from "./references";
import { normalizePlacementItem } from "./resource-binding";

interface NormalizePageInput {
  ext: NormalizedExtension;
  source: LoadedExtensionSource;
  runtime: Accumulator;
  index: RegistryIndex;
  pageId: string;
}
const normalizeMain = (input: NormalizePageInput, main: PageMain): RuntimePageMain => {
  if (main.kind === "panels") return { ...main, empty: normalizeContributionRef(input.ext, main.empty) };
  const { tab, ...presentation } = main;
  return {
    ...presentation,
    view: normalizeContributionRef(input.ext, main.view),
    tab: normalizePlacementTab({ ...input, id: `${input.pageId}.$main`, tab }),
  };
};
const normalizeSlot = (input: NormalizePageInput, slot: PageSlot): RuntimePageSlot => {
  const { tab, ...presentation } = slot;
  return {
    ...presentation,
    item: normalizePlacementItem(input.ext, slot.item),
    tab: normalizePlacementTab({ ...input, id: `${input.pageId}.${slot.id}`, tab }),
  };
};

export const registerPages = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "page",
    contributions: contributionArray<PageContribution>(source.definition.pages),
  });
  for (const contribution of contributions) {
    if (!validateDeclaration({ ext, source, runtime, kind: "page", contribution, schema: pageDeclarationSchema }))
      continue;
    const base = contributionRecordBase(ext, source, "page", contribution.id);
    const ref = normalizeContributionRef(ext, contribution.ref);
    const input = { ext, source, runtime, index, pageId: base.id };
    const slots = contribution.slots.map((slot) => normalizeSlot(input, slot));
    runtime.pages.push({
      ...base,
      contribution: {
        ...contribution,
        ref,
        mode: normalizeContributionRef(ext, contribution.mode),
        ...(contribution.parent ? { parent: normalizeContributionRef(ext, contribution.parent) } : {}),
        ...(contribution.resource
          ? { resource: { kinds: contribution.resource.kinds.map((kind) => normalizeContributionRef(ext, kind)) } }
          : {}),
        main: normalizeMain(input, contribution.main),
        slots,
        panels: Object.fromEntries(
          slots.map((slot) => [slot.id, { kind: "page-slot" as const, page: ref, id: slot.id }]),
        ),
      },
    });
  }
};
