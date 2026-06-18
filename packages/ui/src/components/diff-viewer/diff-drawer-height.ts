import type { Diff } from "./diff-card";
import { isBinaryDiffPath, isImageDiffPath, isLargeDiffContent } from "./diff-size";
import { buildDiffViewData } from "./diff-view-adapter";
import type { DiffViewMode } from "./types";

const CARD_HEADER_HEIGHT = 34;
const CARD_BODY_LINE_HEIGHT = 18;
const HUNK_ROW_HEIGHT = 28;
const COLLAPSED_CARD_HEIGHT = 34;
const DEFERRED_BODY_HEIGHT = 88;
const IMAGE_BODY_HEIGHT = 338;
const ITEM_GAP_HEIGHT = 8;

interface EstimateDiffCardHeightInput {
  diff: Diff;
  isCollapsed: boolean;
  hasOptedIntoLargeDiff?: boolean;
  diffViewMode?: DiffViewMode;
}

const deferredCardHeight = () => CARD_HEADER_HEIGHT + DEFERRED_BODY_HEIGHT + ITEM_GAP_HEIGHT;

// Mirrors the branches DiffCardContent renders, so the virtualizer's estimate matches the DOM
// before measureElement gets a chance to refine it.
export const estimateDiffCardHeight = (input: EstimateDiffCardHeightInput) => {
  const { diff, isCollapsed, hasOptedIntoLargeDiff = false, diffViewMode = "unified" } = input;

  if (isCollapsed) return COLLAPSED_CARD_HEIGHT + ITEM_GAP_HEIGHT;

  const hasDiffContent = diff.oldContent !== undefined || diff.newContent !== undefined;
  const filePath = diff.newPath ?? diff.oldPath ?? "";
  if (isImageDiffPath(filePath) && (diff.oldContent || diff.newContent)) {
    return CARD_HEADER_HEIGHT + IMAGE_BODY_HEIGHT + ITEM_GAP_HEIGHT;
  }
  if (isBinaryDiffPath(filePath)) return deferredCardHeight();
  if (!hasDiffContent) return deferredCardHeight();
  if (isLargeDiffContent(diff) && !hasOptedIntoLargeDiff) return deferredCardHeight();

  const { unifiedContentRows, splitContentRows, hunkRows } = buildDiffViewData({
    original: diff.oldContent ?? "",
    modified: diff.newContent ?? "",
    oldPath: diff.oldPath,
    newPath: diff.newPath,
  });
  const contentRows = diffViewMode === "split" ? splitContentRows : unifiedContentRows;
  if (contentRows === 0 && hunkRows === 0) return deferredCardHeight();

  const bodyHeight = contentRows * CARD_BODY_LINE_HEIGHT + hunkRows * HUNK_ROW_HEIGHT;
  return CARD_HEADER_HEIGHT + bodyHeight + ITEM_GAP_HEIGHT;
};
