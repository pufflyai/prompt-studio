import type { Block, Item } from "../../components/timeline";
import {
  buildBaseTitle,
  buildIndicator,
  getInputObject,
  getOutputText,
  getStringValue,
  prependErrorBlock,
} from "../renderer-helpers";
import type { ToolRenderer } from "../types";

export const renderAgent: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const description = getStringValue(input?.description) ?? undefined;

  const title = buildBaseTitle(invocation, description, "Agent");
  const blocks: Block[] = [];

  const outputText = getOutputText(invocation);
  if (outputText) {
    blocks.push({ type: "code", language: "text", code: outputText });
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};

export const renderTask: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const description = getStringValue(input?.description) ?? undefined;

  const title = buildBaseTitle(invocation, description, "Task");
  const blocks: Block[] = [];

  const outputText = getOutputText(invocation);
  if (outputText) {
    blocks.push({ type: "code", language: "text", code: outputText });
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};
