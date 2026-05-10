import { Box, Button, Grid, IconButton, Text } from "@chakra-ui/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { DiffBubble } from "@/components/diff-bubble";
import { DiffEditor } from "./diff-editor";
import { isLargeDiffContent } from "./diff-size";

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
  onLoadDiff?: (path: string) => Promise<void>;
}

const DeferredDiffLoad = (props: { isLoadingDiff: boolean; onLoadDiff?: () => void }) => {
  const { isLoadingDiff, onLoadDiff } = props;

  return (
    <Box bg="bg" p="sm" borderTop="1px solid" borderColor="border.muted">
      <Text textStyle="sm" color="fg.muted" mb="sm">
        Large diffs are hidden by default
      </Text>
      <Button size="xs" variant="outline" loading={isLoadingDiff} onClick={onLoadDiff}>
        Load diff
      </Button>
    </Box>
  );
};

const LoadingDiffContent = () => (
  <Box bg="bg" p="sm" borderTop="1px solid" borderColor="border.muted">
    <Text textStyle="sm" color="fg.muted">
      Loading diff...
    </Text>
  </Box>
);

const useDiffContentLoader = (input: {
  filePath: string;
  isExpanded: boolean;
  hasDiffContent: boolean;
  isLargeDiff: boolean;
  onLoadDiff?: (path: string) => Promise<void>;
}) => {
  const { filePath, isExpanded, hasDiffContent, isLargeDiff, onLoadDiff } = input;
  const [isLoadingDiff, setLoadingDiff] = useState(false);
  const [requestedPath, setRequestedPath] = useState<string | null>(null);

  const loadDiff = async () => {
    if (!onLoadDiff || isLoadingDiff) return;

    setRequestedPath(filePath);
    setLoadingDiff(true);
    try {
      await onLoadDiff(filePath);
    } finally {
      setLoadingDiff(false);
    }
  };

  useEffect(() => {
    if (!isExpanded || hasDiffContent || isLargeDiff || requestedPath === filePath) return;

    void loadDiff();
  });

  return { isLoadingDiff, loadDiff };
};

const DiffPathLabel = (props: { diff: Diff; filePath: string }) => {
  const { diff, filePath } = props;

  if (diff.change === "renamed") {
    return (
      <Text as="span" textStyle="sm">
        <Text as="span" color="fg.muted" textDecoration="line-through" mr="xs">
          {diff.oldPath}
        </Text>
        <Box as="span" display="inline-flex" alignItems="center" verticalAlign="middle" mr="xs">
          <ChevronRight size={12} />
        </Box>
        {diff.newPath}
      </Text>
    );
  }

  if (diff.change === "deleted") {
    return (
      <Text as="span" color="fg.muted" textDecoration="line-through" textStyle="sm">
        {filePath}
      </Text>
    );
  }

  return (
    <Text as="span" textStyle="sm">
      {filePath}
    </Text>
  );
};

const DiffCardContent = (props: {
  diff: Diff;
  isExpanded: boolean;
  isLargeDiff: boolean;
  shouldAutoLoadDiff: boolean;
  shouldDeferDiff: boolean;
  isLoadingDiff: boolean;
  onLoadDiff: () => Promise<void>;
}) => {
  const { diff, isExpanded, isLargeDiff, shouldAutoLoadDiff, shouldDeferDiff, isLoadingDiff, onLoadDiff } = props;

  if (!isExpanded) return null;

  if (shouldDeferDiff) {
    return <DeferredDiffLoad isLoadingDiff={isLoadingDiff} onLoadDiff={onLoadDiff} />;
  }

  if (shouldAutoLoadDiff) {
    return <LoadingDiffContent />;
  }

  if (isLargeDiff) {
    return (
      <Box bg="bg" p="sm" borderTop="1px solid" borderColor="border.muted">
        <Text textStyle="sm" color="fg.muted">
          Diff content loaded. This file is too large to render inline.
        </Text>
      </Box>
    );
  }

  return (
    <Box bg="bg">
      <DiffEditor
        original={diff.oldContent || ""}
        modified={diff.newContent || ""}
        oldPath={diff.oldPath}
        newPath={diff.newPath}
        sideBySide={false}
      />
    </Box>
  );
};

export const DiffCard = (props: DiffCardProps) => {
  const { diff, isSelected = false, isExpanded = true, onToggleExpanded, onLoadDiff } = props;

  const filePath = diff.newPath || diff.oldPath || "unknown";
  const isLargeDiff = isLargeDiffContent(diff);
  const hasDiffContent = diff.oldContent !== undefined || diff.newContent !== undefined;
  const shouldDeferDiff = !hasDiffContent && isLargeDiff;
  const shouldAutoLoadDiff = !hasDiffContent && !isLargeDiff;
  const { isLoadingDiff, loadDiff } = useDiffContentLoader({
    filePath,
    isExpanded,
    hasDiffContent,
    isLargeDiff,
    onLoadDiff,
  });

  const additions = diff.additions ?? 0;
  const deletions = diff.deletions ?? 0;

  return (
    <Box
      border="1px solid"
      borderColor={isSelected ? "border.accent" : "border.muted"}
      borderRadius="xs"
      overflow="hidden"
      bg={isSelected ? "bg.active" : "bg"}
      width="100%"
      maxW="100%"
      transition="border-color 0.14s ease"
      _hover={{ borderColor: "border.accent" }}
    >
      <Grid
        templateColumns="auto minmax(0, 1fr) auto"
        px="xs"
        py="2xs"
        alignItems="center"
        justifyContent="space-between"
        borderBottom={isExpanded ? "1px solid" : "none"}
        borderColor="border.muted"
        cursor="pointer"
        transition="background 0.14s ease"
        _hover={{ bg: isSelected ? "bg.active" : "bg.subtle" }}
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
          <DiffPathLabel diff={diff} filePath={filePath} />
        </Box>

        <Box flexShrink={0}>
          <DiffBubble variant="ghost" additions={additions} deletions={deletions} />
        </Box>
      </Grid>

      <DiffCardContent
        diff={diff}
        isExpanded={isExpanded}
        isLargeDiff={isLargeDiff}
        shouldAutoLoadDiff={shouldAutoLoadDiff}
        shouldDeferDiff={shouldDeferDiff}
        isLoadingDiff={isLoadingDiff}
        onLoadDiff={loadDiff}
      />
    </Box>
  );
};
