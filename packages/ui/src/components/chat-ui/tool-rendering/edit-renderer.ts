import type { Block, Item } from "../components/timeline";
import {
  buildBaseTitle,
  buildFileLinkSegment,
  buildIndicator,
  getDiffBlocks,
  getInputObject,
  getOutputObject,
  getStringValue,
  prependErrorBlock,
} from "./shared";
import type { ToolRenderer } from "./types";

const buildEditDiff = (original: string, modified: string) => {
  return [
    {
      type: "diff",
      language: "text",
      original,
      modified,
      sideBySide: false,
    },
  ] satisfies Block[];
};

export const renderEdit: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const output = getOutputObject(invocation);

  const filePath =
    getStringValue(input?.filePath) ??
    getStringValue(input?.file_path) ??
    getStringValue(output?.filePath) ??
    undefined;

  const original = getStringValue(output?.oldString) ?? getStringValue(input?.old_string) ?? undefined;
  const modified = getStringValue(output?.newString) ?? getStringValue(input?.new_string) ?? undefined;

  const title = buildBaseTitle(invocation, undefined, "Edit file");
  if (filePath) {
    title.push(buildFileLinkSegment(filePath));
  }

  const diffBlocks =
    original !== undefined && modified !== undefined
      ? buildEditDiff(original, modified)
      : getDiffBlocks(getStringValue(output?.diff));

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, diffBlocks),
  } satisfies Item;
};
