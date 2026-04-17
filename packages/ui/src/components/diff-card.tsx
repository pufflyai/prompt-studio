import { Box, Grid, IconButton, Text } from "@chakra-ui/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DiffBubble } from "@/components/diff-bubble";
import { DiffEditor } from "./diff-editor";

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
}

export const DiffCard = (props: DiffCardProps) => {
  const { diff, isSelected = false, isExpanded = true, onToggleExpanded } = props;

  const filePath = diff.newPath || diff.oldPath || "unknown";

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

      {isExpanded && (
        <Box bg="bg">
          <DiffEditor
            original={diff.oldContent || ""}
            modified={diff.newContent || ""}
            oldPath={diff.oldPath}
            newPath={diff.newPath}
            sideBySide={false}
          />
        </Box>
      )}
    </Box>
  );
};
