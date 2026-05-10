import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { Diff } from "./diff-card";
import { DiffEditor } from "./diff-editor";
import { getDiffLineCount } from "./diff-size";
import {
  buildDiffViewData,
  type DiffViewData,
  getRenderedDiffLineCount,
  isOversizedDiffViewData,
  MAX_RENDERED_DIFF_LINES,
} from "./diff-view-adapter";

interface DiffCardBodyProps {
  diff: Diff;
  filePath: string;
  oldContent: string;
  newContent: string;
  isLargeDiff: boolean;
  hasOptedIntoLargeDiff: boolean;
  onShowFullDiff?: () => void;
}

interface DiffCardBodyModelInput extends DiffCardBodyProps {
  buildViewData?: typeof buildDiffViewData;
}

export const createDiffCardBodyModel = (input: DiffCardBodyModelInput) => {
  const { diff, filePath, oldContent, newContent, isLargeDiff, hasOptedIntoLargeDiff, onShowFullDiff, buildViewData } =
    input;

  if (isLargeDiff && !hasOptedIntoLargeDiff) {
    return {
      kind: "placeholder" as const,
      filePath,
      renderedLineCount: getDiffLineCount(diff),
      onShowFullDiff,
    };
  }

  const diffViewData = (buildViewData ?? buildDiffViewData)({
    original: oldContent,
    modified: newContent,
    oldPath: diff.oldPath,
    newPath: diff.newPath,
  });
  const renderedLineCount = getRenderedDiffLineCount(diffViewData);
  const isOversizedDiff = isOversizedDiffViewData(diffViewData);

  if (isOversizedDiff && !hasOptedIntoLargeDiff) {
    return {
      kind: "placeholder" as const,
      filePath,
      renderedLineCount,
      onShowFullDiff,
    };
  }

  return {
    kind: "editor" as const,
    diffViewData,
  };
};

export const DiffCardBody = (props: DiffCardBodyProps) => {
  const { diff, filePath, oldContent, newContent, isLargeDiff, hasOptedIntoLargeDiff, onShowFullDiff } = props;
  const model = createDiffCardBodyModel({
    diff,
    filePath,
    oldContent,
    newContent,
    isLargeDiff,
    hasOptedIntoLargeDiff,
    onShowFullDiff,
  });

  return (
    <Box bg="bg" borderBottomRadius="xs" overflow="hidden">
      {model.kind === "editor" ? (
        <DiffEditor
          original={oldContent}
          modified={newContent}
          oldPath={diff.oldPath}
          newPath={diff.newPath}
          sideBySide={false}
          data={model.diffViewData}
        />
      ) : (
        <LargeDiffPlaceholder
          filePath={model.filePath}
          renderedLineCount={model.renderedLineCount}
          onShowFullDiff={model.onShowFullDiff}
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
          Large diffs are hidden by default
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

export type TestDiffViewData = DiffViewData;
