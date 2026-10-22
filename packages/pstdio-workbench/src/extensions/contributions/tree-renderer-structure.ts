import { text } from "pstdio-extensions/workbench";
import type { ResourceRef } from "../../core";
import type { ExtensionTreeRendererRecord } from "./tree-renderer-contribution-types";

export const extensionTreeStructure = (record: ExtensionTreeRendererRecord, resource?: ResourceRef) =>
  (record.structure ?? []).map((section) => ({
    id: section.id,
    label: text(section.label),
    collapsible: section.collapsible,
    hiddenByDefault: section.hiddenByDefault,
    canHide: section.canHide,
    loading: !section.resourceNode,
    nodes:
      section.resourceNode && resource
        ? [
            {
              id: section.resourceNode.id,
              label: resource.label ?? resource.id ?? resource.type,
              icon: section.resourceNode.icon,
              resource,
              selected: true,
            },
          ]
        : [],
  }));
