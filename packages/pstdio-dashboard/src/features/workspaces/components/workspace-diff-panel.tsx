import {
  Box,
  Button,
  ButtonGroup,
  createTreeCollection,
  Flex,
  Icon,
  Menu,
  Skeleton,
  Stack,
  Text,
  TreeView,
} from "@chakra-ui/react";
import { type Diff, DiffDrawer, EmptyState, MenuItem } from "@pstdio/ui";
import { ChevronDown, ChevronRight, FileText, Folder } from "lucide-react";
import { useMemo, useState } from "react";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import {
  buildChangedFilesTree,
  type ChangedFilesViewMode,
  type ChangedFileTreeNode,
  collectChangedFilePaths,
} from "../utils/build-changed-files-tree";

interface WorkspaceDiffPanelProps {
  diffs: Diff[];
  artifacts: ApiWorkspaceArtifact[];
  changedFiles: ApiFileDiff[];
  loading?: boolean;
}

const resolveArtifactLabel = (relativePath: string) => {
  const segments = relativePath.split("/");
  const fileName = segments.at(-1) ?? relativePath;
  const directory = segments.length > 1 ? `${segments.slice(0, -1).join("/")}/` : "";

  const extensionStart = fileName.startsWith(".") ? fileName.indexOf(".", 1) : fileName.lastIndexOf(".");
  const baseName = extensionStart > 0 ? fileName.slice(0, extensionStart) : fileName;

  return `${directory}${baseName}`;
};

const WorkspaceDiffPanelLoading = () => (
  <Stack h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="xs" px="sm" py="sm">
    <Skeleton height="22px" borderRadius="sm" />
    <Skeleton height="22px" borderRadius="sm" />
    <Skeleton height="110px" borderRadius="sm" />
    <Skeleton height="110px" borderRadius="sm" />
  </Stack>
);

const collectExpandedFolderIds = (nodes: ChangedFileTreeNode[]) => {
  const folderIds: string[] = [];

  const collect = (items: ChangedFileTreeNode[]) => {
    items.forEach((item) => {
      if (item.type !== "folder") return;
      folderIds.push(item.id);
      collect(item.children ?? []);
    });
  };

  collect(nodes);

  return folderIds;
};

interface ChangedFilesSectionProps {
  changedFiles: ApiFileDiff[];
  hasDiffs: boolean;
}

const ChangedFilesSection = (props: ChangedFilesSectionProps) => {
  const { changedFiles, hasDiffs } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ChangedFilesViewMode>("nested");

  const changedFilePaths = useMemo(() => collectChangedFilePaths(changedFiles), [changedFiles]);
  const changedFileTree = useMemo(
    () => buildChangedFilesTree(changedFilePaths, viewMode),
    [changedFilePaths, viewMode],
  );
  const expandedFolders = useMemo(
    () => (viewMode === "nested" ? collectExpandedFolderIds(changedFileTree) : []),
    [changedFileTree, viewMode],
  );
  const changedFileCollection = useMemo(
    () =>
      createTreeCollection<ChangedFileTreeNode>({
        rootNode: { id: "__root__", name: "root", type: "folder", children: changedFileTree },
        nodeToValue: (node) => node.id,
        nodeToString: (node) => node.name,
        nodeToChildren: (node) => node.children ?? [],
      }),
    [changedFileTree],
  );

  if (changedFilePaths.length === 0) {
    return null;
  }

  return (
    <Stack gap="0" px="sm" py="xs" borderBottomWidth={hasDiffs ? "1px" : "0"}>
      <Flex justify="space-between" align="center" py="2xs">
        <Button variant="ghost" size="xs" gap="2xs" px="0" onClick={() => setIsOpen((open) => !open)}>
          <Icon as={isOpen ? ChevronDown : ChevronRight} boxSize="14px" color="fg.muted" />
          <Text textStyle="label/S/medium" color="foreground.secondary">
            Changed files ({changedFilePaths.length})
          </Text>
        </Button>

        {isOpen ? (
          <ButtonGroup size="2xs" variant="outline" attached>
            <Button
              onClick={() => setViewMode("nested")}
              colorPalette={viewMode === "nested" ? "gray" : undefined}
              variant={viewMode === "nested" ? "solid" : "outline"}
            >
              Nested
            </Button>
            <Button
              onClick={() => setViewMode("flat")}
              colorPalette={viewMode === "flat" ? "gray" : undefined}
              variant={viewMode === "flat" ? "solid" : "outline"}
            >
              Flat
            </Button>
          </ButtonGroup>
        ) : null}
      </Flex>

      {isOpen ? (
        <Box borderWidth="1px" borderColor="border.muted" borderRadius="sm" bg="bg" px="xs" py="xs" mb="xs">
          <TreeView.Root
            collection={changedFileCollection}
            aria-label="Changed files"
            defaultExpandedValue={expandedFolders}
          >
            <TreeView.Tree>
              <TreeView.Node
                render={({ node, nodeState }) =>
                  nodeState.isBranch ? (
                    <TreeView.BranchControl gap="2xs" py="2xs">
                      <Icon as={Folder} boxSize="14px" color="fg.muted" />
                      <TreeView.BranchText textStyle="paragraph/XS/medium">{node.name}</TreeView.BranchText>
                    </TreeView.BranchControl>
                  ) : (
                    <TreeView.Item gap="2xs" py="2xs">
                      <Icon as={FileText} boxSize="14px" color="fg.subtle" />
                      <TreeView.ItemText textStyle="paragraph/XS/regular">{node.name}</TreeView.ItemText>
                    </TreeView.Item>
                  )
                }
              />
            </TreeView.Tree>
          </TreeView.Root>
        </Box>
      ) : null}
    </Stack>
  );
};

interface ArtifactsSectionProps {
  artifacts: ApiWorkspaceArtifact[];
  hasDiffs: boolean;
}

const ArtifactsSection = (props: ArtifactsSectionProps) => {
  const { artifacts, hasDiffs } = props;

  if (artifacts.length === 0) {
    return null;
  }

  return (
    <Stack gap="0" px="sm" py="xs" borderBottomWidth={hasDiffs ? "1px" : "0"}>
      <Text textStyle="label/S/medium" color="foreground.secondary" py="xs">
        Artifacts
      </Text>

      <Menu.Root>
        {artifacts.map((artifact) => {
          const label = resolveArtifactLabel(artifact.relative_path);

          return <MenuItem key={artifact.id} primaryLabel={label} variant="compact" />;
        })}
      </Menu.Root>
    </Stack>
  );
};

export const WorkspaceDiffPanel = (props: WorkspaceDiffPanelProps) => {
  const { diffs, artifacts, changedFiles, loading = false } = props;

  const hasDiffs = diffs.length > 0;

  if (loading) {
    return <WorkspaceDiffPanelLoading />;
  }

  return (
    <Stack h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0" data-testid="workspace-diff-panel">
      <ArtifactsSection artifacts={artifacts} hasDiffs={hasDiffs} />
      <ChangedFilesSection changedFiles={changedFiles} hasDiffs={hasDiffs} />

      {hasDiffs ? (
        <Box flex="1" minH="0">
          <DiffDrawer diffs={diffs} />
        </Box>
      ) : (
        <Box flex="1" minH="0" px="md" py="lg" display="flex" alignItems="center" justifyContent="center">
          <EmptyState
            title="No diffs yet"
            description="Changes in this workspace will appear here once files are modified."
            data-testid="workspace-diff-panel-empty"
          />
        </Box>
      )}
    </Stack>
  );
};
