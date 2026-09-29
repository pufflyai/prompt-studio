import type { TreeListSection } from "@pstdio/ui";
import type { TreeViewSection } from "../../../core";

export const pinnedOnlyNodeIds = (sections: readonly TreeViewSection[]) =>
  new Set(sections.flatMap((section) => section.nodes.filter((node) => node.pinnedOnly).map((node) => node.id)));

// Pinned-only rows render where users pinned them (header or footer), never in the body.
export const withoutPinnedOnlyRows = (sections: TreeListSection[], ids: ReadonlySet<string>) => {
  if (ids.size === 0) return sections;
  return sections.flatMap((section) => {
    const nodes = section.nodes.filter((node) => !ids.has(node.id));
    if (nodes.length === section.nodes.length) return [section];
    return nodes.length > 0 ? [{ ...section, nodes }] : [];
  });
};
