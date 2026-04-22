import type { ToolPart } from "../agent-types";
import type { Block, Item, TitleSegment } from "../components/timeline";
import { basenameSafe } from "../utils/diff";
import { toolTypeToIconName } from "../utils/get-icon";

const TOOL_LABELS: Record<string, string> = {
  apply_patch: "Apply patch",
  bash: "Run command",
  edit: "Edit file",
  glob: "Find files",
  grep: "Search files",
  read: "Read file",
  skill: "Load skill",
  todo_write: "Update todos",
};

const STATE_LABELS: Record<string, string> = {
  pending: "queued",
  error: "failed",
  "output-error": "failed",
  "input-streaming": "running",
  "input-available": "queued",
};

export const normalizeToolType = (value: string) => {
  return value
    .replace(/^tool-/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
};

const toTitleCase = (value: string) => {
  return value
    .split(" ")
    .filter((token) => token.length > 0)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
};

export const getToolType = (invocation: ToolPart) => normalizeToolType(invocation.tool ?? "tool");

export const getToolLabel = (value: string) => {
  const normalized = normalizeToolType(value);
  return TOOL_LABELS[normalized] ?? toTitleCase(normalized.replace(/_/g, " "));
};

const getStateLabel = (state?: unknown) => {
  if (!state || typeof state !== "string") return null;
  if (STATE_LABELS[state]) return STATE_LABELS[state];
  if (state.includes("stream")) return "running";
  return null;
};

export const isErrorState = (state?: string) => state === "error" || state === "output-error";

export const buildIndicator = (invocation: ToolPart) => {
  if (isErrorState(invocation.state?.status)) {
    return { type: "icon", icon: "danger" } as const;
  }

  return { type: "icon", icon: toolTypeToIconName(getToolType(invocation)) } as const;
};

export const buildBaseTitle = (invocation: ToolPart, detail?: string, labelOverride?: string) => {
  const label = labelOverride ?? getToolLabel(invocation.tool ?? "tool");
  const title: TitleSegment[] = [{ kind: "text", text: label, bold: true }];

  if (detail) {
    title.push({ kind: "text", text: detail, muted: true });
  }

  const stateLabel = getStateLabel(invocation.state?.status);
  if (stateLabel) {
    title.push({ kind: "text", text: stateLabel, muted: true });
  }

  return title;
};

export const getObjectValue = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const getInputObject = (invocation: ToolPart) => getObjectValue(invocation.state?.input);

export const getOutputObject = (invocation: ToolPart) => getObjectValue(invocation.state?.output);

export const getStringValue = (value: unknown) => {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return null;
};

export const getArrayValue = (value: unknown) => {
  if (!Array.isArray(value)) return null;
  return value;
};

export const getStateObject = (invocation: ToolPart, key: string) => {
  const state = getObjectValue(invocation.state);
  if (!state) return null;
  return getObjectValue(state[key]);
};

export const normalizeFilePath = (value: string) => value.replace(/\\/g, "/").replace(/^\/+/, "");

export const buildFileLinkSegment = (filePath: string): TitleSegment => {
  return {
    kind: "link",
    text: basenameSafe(filePath),
    filePath,
  };
};

export const getOutputText = (invocation: ToolPart) => {
  const outputObject = getOutputObject(invocation);
  const metadata = getObjectValue(invocation.state?.metadata);

  return (
    getStringValue(invocation.state?.output) ??
    getStringValue(outputObject?.returnDisplay) ??
    getStringValue(outputObject?.preview) ??
    getStringValue(outputObject?.stdout) ??
    getStringValue(metadata?.stdout)
  );
};

export const prependErrorBlock = (invocation: ToolPart, blocks: Block[]): Block[] => {
  if (!isErrorState(invocation.state?.status) || !invocation.state?.errorText) return blocks;
  return [{ type: "comment", text: invocation.state.errorText }, ...blocks];
};

export const createItem = (invocation: ToolPart, title: TitleSegment[], blocks: Block[]): Item => {
  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};
