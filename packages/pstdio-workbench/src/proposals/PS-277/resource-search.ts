import type { TreeListNode, TreeListSection } from "@pstdio/ui";

const matchingNodes = (nodes: TreeListNode[], query: string): TreeListNode[] =>
  nodes.flatMap((node) => {
    if (String(node.label).toLowerCase().includes(query)) return [node];
    const children = matchingNodes(node.children ?? [], query);
    return children.length ? [{ ...node, children }] : [];
  });

export const filterResourceSections = (sections: TreeListSection[], search: string) => {
  const query = search.trim().toLowerCase();
  if (!query) return sections;
  return sections
    .map((section) => ({ ...section, nodes: matchingNodes(section.nodes, query) }))
    .filter((section) => section.nodes.length > 0);
};
