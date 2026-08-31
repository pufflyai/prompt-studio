import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchModePlacementContribution } from "../../core";
import { metadataRefId } from "./workbench-extension-metadata-ref";

type MetadataPlacement = WorkbenchExtensionMetadata["placements"][number];
type MetadataResourceSlot = Extract<MetadataPlacement["item"], { kind: "resource-slot" }>["slot"];

const sameResourceSlot = (
  left: MetadataResourceSlot,
  right: WorkbenchExtensionMetadata["resourceViews"][number]["slot"],
) =>
  left.id === right.id &&
  left.resourceKind.extensionId === right.resourceKind.extensionId &&
  left.resourceKind.id === right.resourceKind.id;

const resourcePlacementItem = (
  metadata: WorkbenchExtensionMetadata,
  placement: MetadataPlacement,
): WorkbenchModePlacementContribution["item"] => {
  const item = placement.item;
  if (item.kind !== "resource-slot") throw new Error("Expected a resource-slot placement");
  const edges = metadata.resourceViews.filter((candidate) => sameResourceSlot(item.slot, candidate.slot));
  if (edges.length !== 1) {
    throw new Error(`Mode placement "${placement.id}" must resolve exactly one resource view; found ${edges.length}`);
  }
  const edge = edges[0]!;
  const kind = metadata.resourceKinds.find(
    (candidate) =>
      candidate.extensionId === item.slot.resourceKind.extensionId && candidate.localId === item.slot.resourceKind.id,
  );
  const slot = kind?.slots?.find((candidate) => candidate.id === item.slot.id);
  if (!slot) throw new Error(`Mode placement "${placement.id}" has no resource slot definition`);
  return {
    kind: "resource",
    viewId: metadataRefId(edge.view),
    resourceKind: item.slot.resourceKind.id,
    cardinality: slot.cardinality,
  };
};

export const toInternalWorkbenchModePlacements = (
  metadata: WorkbenchExtensionMetadata,
): WorkbenchModePlacementContribution[] =>
  metadata.placements.map((placement) => ({
    id: placement.id,
    ref: { extensionId: placement.extensionId, kind: "placement", id: placement.localId },
    modeId: metadataRefId(placement.mode),
    item:
      placement.item.kind === "view"
        ? { kind: "view", viewId: metadataRefId(placement.item.view) }
        : resourcePlacementItem(metadata, placement),
    region: placement.region,
    ...(placement.order === undefined ? {} : { order: placement.order }),
    ...(placement.defaultOpen === undefined ? {} : { defaultOpen: placement.defaultOpen }),
    ...(placement.required === undefined ? {} : { required: placement.required }),
    ...(placement.movableTo ? { movableTo: placement.movableTo } : {}),
  }));
