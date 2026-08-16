import type { ResourceRef } from "../resources/resource-registry";

export const FILE_SECTION_NAVIGATION_METADATA_KEY = "pstdio.fileSectionNavigation";

export interface FileSectionAnchor {
  id: string;
  heading: string;
  occurrence?: number;
}

export interface FileSectionNavigation {
  treeId: string;
  targetNodeId: string;
  anchors: FileSectionAnchor[];
}

const isAnchor = (value: unknown): value is FileSectionAnchor => {
  if (!value || typeof value !== "object") return false;
  const anchor = value as Record<string, unknown>;
  const occurrenceIsValid =
    anchor.occurrence === undefined ||
    (typeof anchor.occurrence === "number" && Number.isInteger(anchor.occurrence) && anchor.occurrence >= 0);
  return typeof anchor.id === "string" && typeof anchor.heading === "string" && occurrenceIsValid;
};

export const getFileSectionNavigation = (resource: ResourceRef | undefined): FileSectionNavigation | undefined => {
  const value = resource?.metadata?.[FILE_SECTION_NAVIGATION_METADATA_KEY];
  if (!value || typeof value !== "object") return undefined;
  const navigation = value as Record<string, unknown>;
  if (typeof navigation.treeId !== "string" || typeof navigation.targetNodeId !== "string") return undefined;
  if (!Array.isArray(navigation.anchors) || !navigation.anchors.every(isAnchor)) return undefined;

  return {
    treeId: navigation.treeId,
    targetNodeId: navigation.targetNodeId,
    anchors: navigation.anchors,
  };
};

export const resolveFileSectionTargetId = (navigation: FileSectionNavigation, selectedNodeId: string | undefined) => {
  if (selectedNodeId && navigation.anchors.some((anchor) => anchor.id === selectedNodeId)) return selectedNodeId;
  return navigation.targetNodeId;
};

export interface PreviousFileSectionNavigation {
  resourceUri?: string;
  treeId: string;
  anchorIds: string[];
}

export const shouldClearFileSectionSelection = (input: {
  previous: PreviousFileSectionNavigation | null;
  current: FileSectionNavigation | undefined;
  currentResourceUri?: string;
  selectedNodeId?: string;
}) => {
  const { previous, current, currentResourceUri, selectedNodeId } = input;
  if (!previous || !selectedNodeId || !previous.anchorIds.includes(selectedNodeId)) return false;
  if (current?.targetNodeId === selectedNodeId) return false;

  return !current || previous.treeId !== current.treeId || previous.resourceUri !== currentResourceUri;
};
