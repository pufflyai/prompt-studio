import { Box, Grid, IconButton, Text } from "@chakra-ui/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { DiffBubble } from "./diff-bubble";
import { DiffCardContent } from "./diff-card-content";
import { isBinaryDiffPath, isGeneratedDiffPath, isImageDiffPath, isLargeDiffContent } from "./diff-size";
import type { DiffViewMode } from "./types";

export interface Diff {
  change: "added" | "deleted" | "modified" | "renamed" | "copied" | "permissionChange";
  oldPath?: string;
  newPath?: string;
  oldContent?: string;
  newContent?: string;
  additions?: number;
  deletions?: number;
}

interface DiffCardProps {
  diff: Diff;
  isSelected?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onSelect?: () => void;
  onLoadDiff?: (path: string) => Promise<void>;
  hasOptedIntoLargeDiff?: boolean;
  onShowFullDiff?: () => void;
  diffViewMode?: DiffViewMode;
}

interface DiffCardHeaderProps {
  diff: Diff;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export const shouldAutoLoadDiffContent = (input: {
  isExpanded: boolean;
  isSelected: boolean;
  hasDiffContent: boolean;
  isLargeDiff: boolean;
  isGeneratedDiff: boolean;
  isBinaryDiff: boolean;
  requestedPath: string | null;
  filePath: string;
}) => {
  const { isExpanded, hasDiffContent, isLargeDiff, isGeneratedDiff, isBinaryDiff, requestedPath, filePath } = input;

  return (
    isExpanded && !hasDiffContent && !isLargeDiff && !isGeneratedDiff && !isBinaryDiff && requestedPath !== filePath
  );
};

export const resolveRequestedDiffPath = (input: {
  requestedPath: string | null;
  filePath: string;
  hasDiffContent: boolean;
}) => {
  const { requestedPath, filePath, hasDiffContent } = input;

  if (requestedPath === filePath && hasDiffContent) {
    return null;
  }

  return requestedPath;
};

export const shouldShowDiffStats = (filePath: string) => !isImageDiffPath(filePath);

const useDiffContentLoader = (input: {
  filePath: string;
  isExpanded: boolean;
  isSelected: boolean;
  hasDiffContent: boolean;
  isLargeDiff: boolean;
  isGeneratedDiff: boolean;
  isBinaryDiff: boolean;
  onLoadDiff?: (path: string) => Promise<void>;
}) => {
  const { filePath, isExpanded, isSelected, hasDiffContent, isLargeDiff, isGeneratedDiff, isBinaryDiff, onLoadDiff } =
    input;
  const [isLoadingDiff, setLoadingDiff] = useState(false);
  const [requestedPath, setRequestedPath] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const loadDiff = async () => {
    if (!onLoadDiff || isLoadingDiff) return;

    setRequestedPath(filePath);
    setLoadError(false);
    setLoadingDiff(true);
    try {
      await onLoadDiff(filePath);
    } catch {
      setRequestedPath(null);
      setLoadError(true);
    } finally {
      setLoadingDiff(false);
    }
  };

  const shouldAutoLoadDiff = shouldAutoLoadDiffContent({
    isExpanded,
    isSelected,
    hasDiffContent,
    isLargeDiff,
    isGeneratedDiff,
    isBinaryDiff,
    requestedPath,
    filePath,
  });

  useEffect(() => {
    setRequestedPath((current) => resolveRequestedDiffPath({ requestedPath: current, filePath, hasDiffContent }));
  }, [filePath, hasDiffContent]);

  useEffect(() => {
    if (!onLoadDiff || !shouldAutoLoadDiff || loadError) {
      return;
    }

    void loadDiff();
  });

  return {
    isLoadingDiff,
    loadError,
    shouldAutoLoadDiff: Boolean(onLoadDiff) && shouldAutoLoadDiff && !loadError,
    loadDiff,
  };
};

export const DiffCard = (props: DiffCardProps) => {
  const {
    diff,
    isSelected = false,
    isExpanded = true,
    onToggleExpanded,
    onSelect,
    onLoadDiff,
    hasOptedIntoLargeDiff = false,
    onShowFullDiff,
    diffViewMode = "unified",
  } = props;

  const filePath = diff.newPath || diff.oldPath || "unknown";
  const oldContent = diff.oldContent || "";
  const newContent = diff.newContent || "";
  const isLargeDiff = isLargeDiffContent(diff);
  const isGeneratedDiff = isGeneratedDiffPath(filePath);
  const isBinaryDiff = isBinaryDiffPath(filePath);
  const blocksDiffContentLoad = isBinaryDiff && !isImageDiffPath(filePath);
  const hasDiffContent = diff.oldContent !== undefined || diff.newContent !== undefined;
  const { isLoadingDiff, loadError, shouldAutoLoadDiff, loadDiff } = useDiffContentLoader({
    filePath,
    isExpanded,
    isSelected,
    hasDiffContent,
    isLargeDiff: isLargeDiff && !hasOptedIntoLargeDiff,
    isGeneratedDiff,
    isBinaryDiff: blocksDiffContentLoad,
    onLoadDiff,
  });

  return (
    <Box
      data-testid="diff-card"
      border="1px solid"
      borderColor={isSelected ? "border.accent" : "border.subtle"}
      borderRadius="xs"
      overflow="visible"
      bg="bg"
      width="100%"
      maxW="100%"
      transition="border-color 0.14s ease"
      _hover={{ borderColor: "border.accent" }}
      onClick={onSelect}
    >
      <DiffCardHeader diff={diff} isExpanded={isExpanded} onToggleExpanded={onToggleExpanded} />

      <DiffCardContent
        diff={diff}
        filePath={filePath}
        oldContent={oldContent}
        newContent={newContent}
        isExpanded={isExpanded}
        isLargeDiff={isLargeDiff}
        isGeneratedDiff={isGeneratedDiff}
        isBinaryDiff={blocksDiffContentLoad}
        hasDiffContent={hasDiffContent}
        canLoadDiff={Boolean(onLoadDiff)}
        shouldAutoLoadDiff={shouldAutoLoadDiff}
        loadError={loadError}
        isLoadingDiff={isLoadingDiff}
        onLoadDiff={loadDiff}
        hasOptedIntoLargeDiff={hasOptedIntoLargeDiff}
        onShowFullDiff={onShowFullDiff}
        diffViewMode={diffViewMode}
      />
    </Box>
  );
};

export const DiffCardHeader = (props: DiffCardHeaderProps) => {
  const { diff, isExpanded = true, onToggleExpanded } = props;
  const filePath = diff.newPath || diff.oldPath || "unknown";
  const additions = diff.additions ?? 0;
  const deletions = diff.deletions ?? 0;
  const showStats = shouldShowDiffStats(filePath);

  return (
    <Grid
      data-testid="diff-card-header"
      templateColumns="auto minmax(0, 1fr) auto"
      px="xs"
      py="2xs"
      alignItems="center"
      justifyContent="space-between"
      borderBottom={isExpanded ? "1px solid" : "none"}
      borderColor="border.subtle"
      borderTopRadius="xs"
      borderBottomRadius={isExpanded ? "0" : "xs"}
      position="sticky"
      top="0"
      zIndex="1"
      bg="bg"
      cursor="pointer"
      transition="background 0.14s ease"
      _hover={{ bg: "bg" }}
      onClick={() => onToggleExpanded?.()}
      gap="sm"
    >
      <IconButton
        aria-label={isExpanded ? "Collapse" : "Expand"}
        variant="ghost"
        size="2xs"
        onClick={(event) => {
          event.stopPropagation();
          onToggleExpanded?.();
        }}
        flexShrink={0}
      >
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </IconButton>

      <Box minW={0} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" title={filePath}>
        {diff.change === "renamed" ? (
          <Text as="span" textStyle="sm">
            <Text as="span" color="fg.muted" textDecoration="line-through" mr="xs">
              {diff.oldPath}
            </Text>
            <Box as="span" display="inline-flex" alignItems="center" verticalAlign="middle" mr="xs">
              <ChevronRight size={12} />
            </Box>
            {diff.newPath}
          </Text>
        ) : diff.change === "deleted" ? (
          <Text as="span" color="fg.muted" textDecoration="line-through" textStyle="sm">
            {filePath}
          </Text>
        ) : (
          <Text as="span" textStyle="sm">
            {filePath}
          </Text>
        )}
      </Box>

      {showStats ? (
        <Box flexShrink={0}>
          <DiffBubble variant="ghost" additions={additions} deletions={deletions} />
        </Box>
      ) : null}
    </Grid>
  );
};
