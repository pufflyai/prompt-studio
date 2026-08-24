const TREE_NODE_DATA_TYPE = "application/x-pstdio-tree-node";

interface TreeNodeDataTransfer {
  getData(type: string): string;
  setData(type: string, value: string): void;
}

export const writeDraggedTreeNodeId = (dataTransfer: TreeNodeDataTransfer, nodeId: string) => {
  dataTransfer.setData(TREE_NODE_DATA_TYPE, nodeId);
};

export const readDraggedTreeNodeId = (dataTransfer: TreeNodeDataTransfer) =>
  dataTransfer.getData(TREE_NODE_DATA_TYPE) || undefined;
