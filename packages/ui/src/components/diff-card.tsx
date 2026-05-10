import { Box, Button, Grid, IconButton, Stack, Text } from "@chakra-ui/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DiffBubble } from "@/components/diff-bubble";
import { DiffEditor } from "./diff-editor";
import {
  buildDiffViewData,
  getRenderedDiffLineCount,
  isOversizedDiffViewData,
  MAX_RENDERED_DIFF_LINES,
} from "./diff-view-adapter";

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
  hasOptedIntoLargeDiff?: boolean;
  onShowFullDiff?: () => void;
}

interface DiffCardHeaderProps {
  diff: Diff;
  isSelected?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export const DiffCard = (props: DiffCardProps) => {
  const {
    diff,
    isSelected = false,
    isExpanded = true,
    onToggleExpanded,
    hasOptedIntoLargeDiff = false,
    onShowFullDiff,
  } = props;

  const filePath = diff.newPath || diff.oldPath || "unknown";
  const oldContent = diff.oldContent || "";
  const newContent = diff.newContent || "";

  return (
    <Box
      data-testid="diff-card"
      border="1px solid"
      borderColor={isSelected ? "border.accent" : "border.muted"}
      borderRadius="xs"
      overflow="visible"
      bg={isSelected ? "bg.active" : "bg"}
      width="100%"
      maxW="100%"
      transition="border-color 0.14s ease"
      _hover={{ borderColor: "border.accent" }}
    >
      <DiffCardHeader diff={diff} isSelected={isSelected} isExpanded={isExpanded} onToggleExpanded={onToggleExpanded} />

      {isExpanded && (
        <DiffCardBody
          diff={diff}
          filePath={filePath}
          oldContent={oldContent}
          newContent={newContent}
          hasOptedIntoLargeDiff={hasOptedIntoLargeDiff}
          onShowFullDiff={onShowFullDiff}
        />
      )}
    </Box>
  );
};

export const DiffCardHeader = (props: DiffCardHeaderProps) => {
  const { diff, isSelected = false, isExpanded = true, onToggleExpanded } = props;
  const filePath = diff.newPath || diff.oldPath || "unknown";
  const additions = diff.additions ?? 0;
  const deletions = diff.deletions ?? 0;

  return (
    <Grid
      data-testid="diff-card-header"
      templateColumns="auto minmax(0, 1fr) auto"
      px="xs"
      py="2xs"
      alignItems="center"
      justifyContent="space-between"
      borderBottom={isExpanded ? "1px solid" : "none"}
      borderColor="border.muted"
      borderTopRadius="xs"
      borderBottomRadius={isExpanded ? "0" : "xs"}
      position="sticky"
      top="0"
      zIndex="1"
      bg={isSelected ? "bg.active" : "bg"}
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

      <Box flexShrink={0}>
        <DiffBubble variant="ghost" additions={additions} deletions={deletions} />
      </Box>
    </Grid>
  );
};

interface DiffCardBodyProps {
  diff: Diff;
  filePath: string;
  oldContent: string;
  newContent: string;
  hasOptedIntoLargeDiff: boolean;
  onShowFullDiff?: () => void;
}

const DiffCardBody = (props: DiffCardBodyProps) => {
  const { diff, filePath, oldContent, newContent, hasOptedIntoLargeDiff, onShowFullDiff } = props;

  const diffViewData = buildDiffViewData({
    original: oldContent,
    modified: newContent,
    oldPath: diff.oldPath,
    newPath: diff.newPath,
  });
  const renderedLineCount = getRenderedDiffLineCount(diffViewData);
  const isOversizedDiff = isOversizedDiffViewData(diffViewData);
  const shouldRenderDiff = !isOversizedDiff || hasOptedIntoLargeDiff;

  return (
    <Box bg="bg" borderBottomRadius="xs" overflow="hidden">
      {shouldRenderDiff ? (
        <DiffEditor
          original={oldContent}
          modified={newContent}
          oldPath={diff.oldPath}
          newPath={diff.newPath}
          sideBySide={false}
          data={diffViewData}
        />
      ) : (
        <LargeDiffPlaceholder
          filePath={filePath}
          renderedLineCount={renderedLineCount}
          onShowFullDiff={onShowFullDiff}
        />
      )}
    </Box>
  );
};

interface LargeDiffPlaceholderProps {
  filePath: string;
  renderedLineCount: number;
  onShowFullDiff?: () => void;
}

const LargeDiffPlaceholder = (props: LargeDiffPlaceholderProps) => {
  const { filePath, renderedLineCount, onShowFullDiff } = props;

  return (
    <Stack gap="sm" p="md" borderTop="1px solid" borderColor="border.muted" bg="bg.subtle">
      <Stack gap="2xs">
        <Text fontWeight="medium" textStyle="sm">
          Large diff hidden by default
        </Text>
        <Text color="fg.muted" textStyle="xs">
          This file has {renderedLineCount.toLocaleString()} rendered diff lines, which is over the{" "}
          {MAX_RENDERED_DIFF_LINES.toLocaleString()} line default limit.
        </Text>
      </Stack>
      <Button
        size="xs"
        variant="outline"
        alignSelf="flex-start"
        aria-label={`Render full diff for ${filePath}`}
        onClick={onShowFullDiff}
      >
        Show full diff
      </Button>
    </Stack>
  );
};
