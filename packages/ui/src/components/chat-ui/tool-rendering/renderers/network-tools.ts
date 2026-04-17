import type { Block, Item, TitleSegment } from "../../components/timeline";
import {
  buildBaseTitle,
  buildIndicator,
  getInputObject,
  getOutputText,
  getStringValue,
  prependErrorBlock,
} from "../renderer-helpers";
import type { ToolRenderer } from "../types";

export const renderWebFetch: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const url = getStringValue(input?.url) ?? undefined;

  const title = buildBaseTitle(invocation, undefined, "Fetch");
  if (url) {
    const linkSegment: TitleSegment = { kind: "link", text: url, href: url };
    title.push(linkSegment);
  }

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

export const renderWebSearch: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const query = getStringValue(input?.query) ?? undefined;

  const title = buildBaseTitle(invocation, query, "Search web");
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
