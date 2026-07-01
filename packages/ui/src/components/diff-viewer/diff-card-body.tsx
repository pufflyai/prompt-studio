import { Box, Button, Grid, Image, Text } from "@chakra-ui/react";
import { EmptyState } from "@/components/primitives/empty-state";
import type { Diff } from "./diff-card";
import { DiffEditor } from "./diff-editor";
import { getDiffLineCount, isBinaryDiffPath, isImageDiffPath } from "./diff-size";
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

  if (isBinaryDiffPath(filePath)) {
    const oldImageSrc = getImagePreviewSource(oldContent);
    const newImageSrc = getImagePreviewSource(newContent);
    if (isImageDiffPath(filePath) && (oldImageSrc || newImageSrc)) {
      return {
        kind: "image" as const,
        filePath,
        oldSrc: oldImageSrc,
        newSrc: newImageSrc,
      };
    }

    return {
      kind: "binary" as const,
      filePath,
      isImage: isImageDiffPath(filePath),
    };
  }

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

const getImagePreviewSource = (content: string) => (content.startsWith("data:image/") ? content : "");

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
      ) : model.kind === "image" ? (
        <ImageDiffPreview oldSrc={model.oldSrc} newSrc={model.newSrc} />
      ) : model.kind === "binary" ? (
        <BinaryDiffPlaceholder isImage={model.isImage} />
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

interface ImageDiffPreviewProps {
  oldSrc: string;
  newSrc: string;
}

const ImageDiffPreview = (props: ImageDiffPreviewProps) => {
  const { oldSrc, newSrc } = props;

  return (
    <Grid
      templateColumns={{ base: "1fr", md: "1fr 1fr" }}
      gap="sm"
      p="sm"
      borderTop="1px solid"
      borderColor="border.subtle"
      bg="bg"
    >
      <ImageDiffPanel label="Old" src={oldSrc} fallback="No old image" />
      <ImageDiffPanel label="New" src={newSrc} fallback="No new image" />
    </Grid>
  );
};

interface ImageDiffPanelProps {
  label: string;
  src: string;
  fallback: string;
}

const ImageDiffPanel = (props: ImageDiffPanelProps) => {
  const { label, src, fallback } = props;

  return (
    <Box border="1px solid" borderColor="border.subtle" borderRadius="xs" overflow="hidden" bg="bg.subtle" minW="0">
      <Text
        px="xs"
        py="2xs"
        textStyle="label/S/medium"
        color="fg.muted"
        borderBottom="1px solid"
        borderColor="border.subtle"
      >
        {label}
      </Text>
      <Box display="grid" placeItems="center" minH="180px" p="sm">
        {src ? (
          <Image src={src} alt={`${label} image diff`} maxH="260px" maxW="100%" objectFit="contain" />
        ) : (
          <Text color="fg.muted" textStyle="body/S/regular">
            {fallback}
          </Text>
        )}
      </Box>
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
    <Box p="md" borderTop="1px solid" borderColor="border.subtle" bg="bg">
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

interface BinaryDiffPlaceholderProps {
  isImage: boolean;
}

const BinaryDiffPlaceholder = (props: BinaryDiffPlaceholderProps) => {
  const { isImage } = props;
  const title = isImage ? "Image diffs are not shown" : "Binary diffs are not shown";

  return (
    <Box p="md" borderTop="1px solid" borderColor="border.subtle" bg="bg">
      <EmptyState title={title} paddingY="sm" />
    </Box>
  );
};

export type TestDiffViewData = BuiltDiffViewData;
