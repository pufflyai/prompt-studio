import { Box, Button } from "@chakra-ui/react";
import { EmptyState } from "../empty-state";
import type { Diff } from "./diff-card";
import { DiffEditor } from "./diff-editor";
import { getDiffLineCount } from "./diff-size";
import { type BuiltDiffViewData, buildDiffViewData } from "./diff-view-adapter";
import type { DiffViewMode } from "./types";

interface DiffCardBodyProps {
  diff: Diff;
  filePath: string;
  oldContent: string;
  newContent: string;
  isLargeDiff: boolean;
  hasOptedIntoLargeDiff: boolean;
  onShowFullDiff?: () => void;
  diffViewMode?: DiffViewMode;
}

interface DiffCardBodyModelInput extends DiffCardBodyProps {
  buildViewData?: typeof buildDiffViewData;
}

export const createDiffCardBodyModel = (input: DiffCardBodyModelInput) => {
  const {
    diff,
    filePath,
    oldContent,
    newContent,
    isLargeDiff,
    hasOptedIntoLargeDiff,
    onShowFullDiff,
    diffViewMode = "unified",
    buildViewData,
  } = input;

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
  return {
    kind: "editor" as const,
    diffViewData,
    sideBySide: diffViewMode === "split",
  };
};

export const DiffCardBody = (props: DiffCardBodyProps) => {
  const {
    diff,
    filePath,
    oldContent,
    newContent,
    isLargeDiff,
    hasOptedIntoLargeDiff,
    onShowFullDiff,
    diffViewMode = "unified",
  } = props;
  const model = createDiffCardBodyModel({
    diff,
    filePath,
    oldContent,
    newContent,
    isLargeDiff,
    hasOptedIntoLargeDiff,
    onShowFullDiff,
    diffViewMode,
  });

  return (
    <Box bg="bg" borderBottomRadius="xs" overflow="hidden">
      {model.kind === "editor" ? (
        <DiffEditor
          original={oldContent}
          modified={newContent}
          oldPath={diff.oldPath}
          newPath={diff.newPath}
          sideBySide={model.sideBySide}
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
  const { filePath, onShowFullDiff } = props;

  return (
    <Box p="md" borderTop="1px solid" borderColor="border.muted" bg="bg">
      <EmptyState title="Large diffs are hidden by default" paddingY="sm">
        {onShowFullDiff ? (
          <Button size="xs" variant="outline" aria-label={`Render full diff for ${filePath}`} onClick={onShowFullDiff}>
            Show full diff
          </Button>
        ) : null}
      </EmptyState>
    </Box>
  );
};

export type TestDiffViewData = BuiltDiffViewData;
