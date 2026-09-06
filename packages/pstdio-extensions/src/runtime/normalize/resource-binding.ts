import type { PlacementItem, ResourceBinding } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import { normalizeNavigationAction } from "./navigation-action";
import { normalizeContributionRef } from "./references";

export const normalizeResourceBinding = (ext: NormalizedExtension, binding: ResourceBinding) => ({
  kinds: binding.kinds.map((kind) => normalizeContributionRef(ext, kind)),
  view: normalizeContributionRef(ext, binding.view),
  cardinality: binding.cardinality,
  ...(binding.add ? { add: normalizeNavigationAction(ext, binding.add) } : {}),
});

export const normalizePlacementItem = (ext: NormalizedExtension, item: PlacementItem): PlacementItem =>
  item.kind === "view"
    ? { ...item, view: normalizeContributionRef(ext, item.view) }
    : { kind: "binding", binding: normalizeResourceBinding(ext, item.binding) };
