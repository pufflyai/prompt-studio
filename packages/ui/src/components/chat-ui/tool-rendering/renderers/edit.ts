import type { Block, Item, TitleSegment } from "../../components/timeline";
import { basenameSafe } from "../../utils/diff";
import { buildBaseTitle, buildIndicator, getInputObject, getStringValue, prependErrorBlock } from "../renderer-utils";
import type { ToolRenderer } from "../types";

const buildFileLinkSegment = (filePath: string): TitleSegment => ({
  kind: "link",
  text: basenameSafe(filePath),
  filePath,
});

export const renderEdit: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);

  const filePath = getStringValue(input?.file_path) ?? getStringValue(input?.filePath) ?? undefined;

  const oldString = getStringValue(input?.old_string);
  const newString = getStringValue(input?.new_string);

  const title = buildBaseTitle(invocation, undefined, "Edit file");
  if (filePath) {
    title.push(buildFileLinkSegment(filePath));
  }

  const blocks: Block[] = [];
  if (oldString && newString) {
    blocks.push({
      type: "diff",
      language: "diff",
      original: oldString,
      modified: newString,
      sideBySide: false,
    });
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};
