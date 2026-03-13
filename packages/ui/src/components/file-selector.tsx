import {
  Checkmark,
  createTreeCollection,
  Icon,
  Spinner,
  Stack,
  Text,
  TreeView,
  useTreeViewNodeContext,
} from "@chakra-ui/react";
import { FileText, Folder } from "lucide-react";

import type { FileTreeItem } from "@/components/file-tree-helpers";
import { EmptyState } from "./empty-state";
import { ScrollArea } from "./scroll-area";

export interface FileSelectorProps {
  files: FileTreeItem[];
  checkedFileIds?: string[];
  defaultCheckedFileIds?: string[];
  label?: string;
  emptyLabel?: string;
  maxHeight?: string | number;
  isLoading?: boolean;
  onCheckedFilesChange?: (files: FileTreeItem[]) => void;
}

const TreeNodeCheckbox = (props: TreeView.NodeCheckboxProps) => {
  const nodeState = useTreeViewNodeContext();

  return (
    <TreeView.NodeCheckbox aria-label="Select node" {...props}>
      <Checkmark
        bg={{
          base: "bg",
          _checked: "colorPalette.solid",
          _indeterminate: "colorPalette.solid",
        }}
        size="sm"
        checked={nodeState.checked === true}
        indeterminate={nodeState.checked === "indeterminate"}
      />
    </TreeView.NodeCheckbox>
  );
};

const collectFiles = (nodes: FileTreeItem[]) => {
  const files: FileTreeItem[] = [];

  nodes.forEach((node) => {
    if (node.type === "file") {
      files.push(node);
      return;
    }

    if (node.children) {
      files.push(...collectFiles(node.children));
    }
  });

  return files;
};

const indexNodesById = (nodes: FileTreeItem[]) => {
  const map = new Map<string, FileTreeItem>();

  const visit = (items: FileTreeItem[]) => {
    items.forEach((item) => {
      map.set(item.id, item);

      if (item.children) {
        visit(item.children);
      }
    });
  };

  visit(nodes);

  return map;
};

export const FileSelector = (props: FileSelectorProps) => {
  const {
    files,
    checkedFileIds,
    defaultCheckedFileIds = [],
    label = "Files",
    emptyLabel = "No files available.",
    maxHeight = "360px",
    isLoading,
    onCheckedFilesChange,
  } = props;

  const collection = createTreeCollection<FileTreeItem>({
    rootNode: { id: "__root__", name: "root", type: "folder", children: files },
    nodeToValue: (node) => node.id,
    nodeToString: (node) => node.name,
    nodeToChildren: (node) => node.children ?? [],
  });

  const expandedBranches = files.filter((item) => item.type === "folder").map((item) => item.id);
  const nodesById = indexNodesById(files);

  const handleCheckedChange = (details: { checkedValue: string[] }) => {
    if (!onCheckedFilesChange) return;

    const uniqueFiles = new Map<string, FileTreeItem>();

    details.checkedValue.forEach((value) => {
      const node = nodesById.get(value);

      if (!node) return;

      const filesFromNode = node.type === "file" ? [node] : collectFiles(node.children ?? []);

      filesFromNode.forEach((file) => {
        uniqueFiles.set(file.id, file);
      });
    });

    onCheckedFilesChange([...uniqueFiles.values()]);
  };

  if (isLoading) {
    return (
      <Stack gap="xs">
        <Text textStyle="paragraph/M/medium">{label}</Text>
        <Stack direction="row" gap="xs" align="center">
          <Spinner color="fg" size="sm" />
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Loading files...
          </Text>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <Text textStyle="paragraph/M/medium">{label}</Text>

      <ScrollArea
        borderWidth="1px"
        borderColor="border.muted"
        borderRadius="md"
        maxH={maxHeight}
        contentProps={{ p: "xs" }}
      >
        {files.length === 0 ? (
          <EmptyState title={emptyLabel} size="sm" textAlign="left" alignItems="flex-start" />
        ) : (
          <TreeView.Root
            collection={collection}
            selectionMode="multiple"
            aria-label={label}
            {...(checkedFileIds ? { checkedValue: checkedFileIds } : { defaultCheckedValue: defaultCheckedFileIds })}
            defaultExpandedValue={expandedBranches}
            onCheckedChange={handleCheckedChange}
          >
            <TreeView.Tree>
              <TreeView.Node
                render={({ node, nodeState }) =>
                  nodeState.isBranch ? (
                    <TreeView.BranchControl gap="xs" py="2px">
                      <TreeNodeCheckbox />
                      <Icon as={Folder} boxSize="16px" color="fg" />
                      <Stack gap="1px">
                        <TreeView.BranchText textStyle="paragraph/S/medium">{node.name}</TreeView.BranchText>
                        {node.meta ? (
                          <Text textStyle="paragraph/XS/regular" color="fg.muted">
                            {node.meta}
                          </Text>
                        ) : null}
                      </Stack>
                    </TreeView.BranchControl>
                  ) : (
                    <TreeView.Item gap="xs" py="2px">
                      <TreeNodeCheckbox />
                      <Icon as={FileText} boxSize="16px" color="fg.muted" />
                      <Stack gap="1px">
                        <TreeView.ItemText textStyle="paragraph/S/regular">{node.name}</TreeView.ItemText>
                        {node.meta ? (
                          <Text textStyle="paragraph/XS/regular" color="fg.muted">
                            {node.meta}
                          </Text>
                        ) : null}
                      </Stack>
                    </TreeView.Item>
                  )
                }
              />
            </TreeView.Tree>
          </TreeView.Root>
        )}
      </ScrollArea>
    </Stack>
  );
};
