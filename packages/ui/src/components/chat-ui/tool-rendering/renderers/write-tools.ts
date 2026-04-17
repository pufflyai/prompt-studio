import type { Block, Item } from "../../components/timeline";
import {
  buildBaseTitle,
  buildFileLinkSegment,
  buildIndicator,
  getInputObject,
  getStringValue,
  prependErrorBlock,
} from "../renderer-helpers";
import type { ToolRenderer } from "../types";

export const renderWrite: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const filePath = getStringValue(input?.file_path) ?? undefined;
  const content = getStringValue(input?.content) ?? undefined;

  const title = buildBaseTitle(invocation, undefined, "Write file");
  if (filePath) {
    title.push(buildFileLinkSegment(filePath));
  }

  const blocks: Block[] = [];
  if (content) {
    blocks.push({ type: "code", language: "text", code: content });
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};

export const renderEdit: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const filePath = getStringValue(input?.file_path) ?? undefined;
  const oldString = getStringValue(input?.old_string) ?? "";
  const newString = getStringValue(input?.new_string) ?? "";

  const title = buildBaseTitle(invocation, undefined, "Edit file");
  if (filePath) {
    title.push(buildFileLinkSegment(filePath));
  }

  const blocks: Block[] = [];
  if (oldString || newString) {
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

export const renderNotebookEdit: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const notebookPath = getStringValue(input?.notebook_path) ?? undefined;
  const newSource = getStringValue(input?.new_source) ?? undefined;

  const title = buildBaseTitle(invocation, undefined, "Edit notebook");
  if (notebookPath) {
    title.push(buildFileLinkSegment(notebookPath));
  }

  const blocks: Block[] = [];
  if (newSource) {
    blocks.push({ type: "code", language: "python", code: newSource });
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};
