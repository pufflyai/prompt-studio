import type { TreeListNode } from "./tree-list.types";
import { TreeListSectionHeader } from "./tree-list-section-header";

const noop = () => {};

export const TreeListGroupHeader = ({ node }: { node: TreeListNode }) => (
  <TreeListSectionHeader
    section={{ id: node.id, label: typeof node.label === "string" ? node.label : undefined, nodes: [] }}
    collapsible={false}
    expanded
    focusId={node.id}
    tabIndex={-1}
    onFocus={noop}
    onToggle={noop}
  />
);
