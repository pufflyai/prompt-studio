import type { ToolPart } from "../components/message-types";
import type { Block, TitleSegment } from "../components/timeline";
import { toolTypeToIconName } from "../utils/get-icon";
import { getToolNameLookupKeys, normalizeToolName } from "../utils/tool-name";
import { createDefaultToolRenderers } from "./default-renderers";
import type { ToolRenderersMap, ToolTimelineBuilderOptions } from "./types";

const STATE_LABELS: Record<string, string> = {
  pending: "queued",
  error: "failed",
  "output-error": "failed",
  "input-streaming": "running",
  "input-available": "queued",
};

const toTitleCase = (value: string) => {
  return value
    .split(" ")
    .filter((token) => token.length > 0)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
};

const getToolLabel = (tool?: string) => {
  const normalized = normalizeToolName(tool ?? "tool").replace(/_/g, " ");
  return toTitleCase(normalized);
};

const isErrorState = (state?: string) => state === "error" || state === "output-error";

const buildIndicator = (invocation: ToolPart) => {
  if (isErrorState(invocation.state?.status)) {
    return { type: "icon", icon: "danger" } as const;
  }

  return { type: "icon", icon: toolTypeToIconName(invocation.tool ?? "tool") } as const;
};

const getStateLabel = (state?: unknown) => {
  if (!state || typeof state !== "string") return null;
  if (STATE_LABELS[state]) return STATE_LABELS[state];
  if (state.includes("stream")) return "running";
  return null;
};

const stringifyValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return null;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return null;
  }
};

const buildGenericBlocks = (invocation: ToolPart): Block[] => {
  const blocks: Block[] = [];

  if (isErrorState(invocation.state?.status) && invocation.state?.errorText) {
    blocks.push({ type: "comment", text: invocation.state.errorText });
  }

  const inputText = stringifyValue(invocation.state?.input);
  if (inputText) {
    blocks.push({ type: "code", language: "json", code: inputText });
  }

  const outputText = stringifyValue(invocation.state?.output);
  if (outputText) {
    blocks.push({ type: "code", language: "json", code: outputText });
  }

  return blocks;
};

const createGenericItem = (invocation: ToolPart) => {
  const title: TitleSegment[] = [{ kind: "text", text: getToolLabel(invocation.tool), bold: true }];
  const stateLabel = getStateLabel(invocation.state?.status);
  if (stateLabel) {
    title.push({ kind: "text", text: stateLabel, muted: true });
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: buildGenericBlocks(invocation),
  };
};

const mergeToolRenderers = (overrides?: ToolRenderersMap) => {
  if (!overrides) return createDefaultToolRenderers();
  return { ...createDefaultToolRenderers(), ...overrides } satisfies ToolRenderersMap;
};

const getRenderer = (invocation: ToolPart, toolRenderers: ToolRenderersMap) => {
  const rawTool = invocation.tool ?? "tool";
  for (const key of getToolNameLookupKeys(rawTool)) {
    const renderer = toolRenderers[key];
    if (renderer) return renderer;
  }

  return undefined;
};

const renderInvocation = (
  invocation: ToolPart,
  toolRenderers: ToolRenderersMap,
  options?: ToolTimelineBuilderOptions,
) => {
  const renderer = getRenderer(invocation, toolRenderers);
  if (renderer) {
    const rendered = renderer(invocation, options);
    if (rendered) return rendered;
  }

  return createGenericItem(invocation);
};

export const buildTimelineDocFromInvocations = (invocations: ToolPart[], options?: ToolTimelineBuilderOptions) => {
  const toolRenderers = mergeToolRenderers(options?.toolRenderers);
  const items = invocations.map((invocation) => renderInvocation(invocation, toolRenderers, options));

  return { items };
};
