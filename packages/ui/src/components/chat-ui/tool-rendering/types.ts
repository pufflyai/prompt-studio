import type { ToolPart } from "../components/message-types";
import type { Item } from "../components/timeline";

export type ToolRenderResult = Item;

export type ToolRenderOptions = {
  labeledBlocks?: boolean;
};

export type ToolRenderer = (invocation: ToolPart, options?: ToolRenderOptions) => ToolRenderResult | null;

export type ToolRenderersMap = Record<string, ToolRenderer>;

export type ToolTimelineBuilderOptions = {
  labeledBlocks?: boolean;
  toolRenderers?: ToolRenderersMap;
};
