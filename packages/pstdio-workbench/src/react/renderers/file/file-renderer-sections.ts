import { resourceKey } from "@pstdio/sdk/extensions";
import { useEffect, useRef } from "react";
import { getWorkbenchRenderers, type ResourceRef, type WorkbenchCore } from "../../../core";
import {
  type getFileSectionNavigation,
  shouldClearFileSectionSelection,
} from "../../../core/registries/renderers/file-section-navigation";

export const useFileSectionSelection = (
  workbench: WorkbenchCore,
  resource: ResourceRef | undefined,
  navigation: ReturnType<typeof getFileSectionNavigation>,
) => {
  const previousRef = useRef<{ resourceKey?: string; treeId: string; anchorIds: string[] } | null>(null);
  useEffect(() => {
    const previous = previousRef.current;
    const selectedNodeId =
      previous && getWorkbenchRenderers(workbench).getTreeRenderer(previous.treeId)
        ? getWorkbenchRenderers(workbench).getTreeState(previous.treeId).selectedNodeId
        : undefined;
    if (
      previous &&
      shouldClearFileSectionSelection({
        previous,
        current: navigation,
        currentResourceKey: resourceKey(resource),
        selectedNodeId,
      })
    )
      getWorkbenchRenderers(workbench).setSelectedNode(previous.treeId, undefined);
    previousRef.current = navigation
      ? {
          resourceKey: resourceKey(resource),
          treeId: navigation.treeId,
          anchorIds: navigation.anchors.map((anchor) => anchor.id),
        }
      : null;
  }, [resource, navigation, workbench]);
};
