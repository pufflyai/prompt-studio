import type { Block, Item } from "../components/timeline";
import {
  buildApplyPatchMetadataTitleSegments,
  buildBaseTitle,
  buildIndicator,
  getApplyPatchDiffText,
  getApplyPatchMetadataFiles,
  getApplyPatchMetadataReferences,
  getDiffBlocks,
  getDiffReferences,
  getDiffTitleSegments,
  prependErrorBlock,
} from "./shared";
import type { ToolRenderer } from "./types";

export const renderApplyPatch: ToolRenderer = (invocation) => {
  const diffText = getApplyPatchDiffText(invocation);
  const metadataFiles = getApplyPatchMetadataFiles(invocation);

  const title = buildBaseTitle(invocation, undefined, "Apply patch");
  const diffSegments = getDiffTitleSegments(diffText);
  if (diffSegments.length > 0) {
    title.push(...diffSegments);
  } else {
    title.push(...buildApplyPatchMetadataTitleSegments(metadataFiles));
  }

  const blocks: Block[] = [...getDiffBlocks(diffText)];

  if (blocks.length === 0) {
    for (const file of metadataFiles) {
      if (!file.before && !file.after) continue;
      blocks.push({
        type: "diff",
        language: "diff",
        original: file.before ?? "",
        modified: file.after ?? "",
        sideBySide: false,
      });
    }
  }

  if (blocks.length === 0) {
    const references = getDiffReferences(diffText);
    if (references.length === 0) {
      references.push(...getApplyPatchMetadataReferences(metadataFiles));
    }
    if (references.length > 0) {
      blocks.push({ type: "references", references });
    }
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};
