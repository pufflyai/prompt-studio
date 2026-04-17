import type { ToolPart } from "../agent-types";
import type { Block, TitleSegment } from "../components/timeline";
import { toolTypeToIconName } from "../utils/get-icon";

const TOOL_LABELS: Record<string, string> = {
  apply_patch: "Apply patch",
  read: "Read file",
  bash: "Run command",
  grep: "Search files",
  glob: "Find files",
  skill: "Load skill",
  edit: "Edit file",
  todowrite: "Update tasks",
};

const STATE_LABELS: Record<string, string> = {
  pending: "queued",
  error: "failed",
  "output-error": "failed",
  "input-streaming": "running",
  "input-available": "queued",
};

const normalizeToolType = (value: string) => value.replace(/^tool-/, "");

const toTitleCase = (value: string) => {
  return value
    .split(" ")
    .filter((token) => token.length > 0)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
};

export const getToolType = (invocation: ToolPart) => normalizeToolType(invocation.tool ?? "tool");

export const getToolLabel = (value: string) => {
  const normalized = normalizeToolType(value).toLowerCase();
  return TOOL_LABELS[normalized] ?? toTitleCase(normalizeToolType(value).replace(/_/g, " "));
};

export const getStateLabel = (state?: unknown) => {
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

export const getInputObject = (invocation: ToolPart) => {
  const input = invocation.state?.input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as Record<string, unknown>;
};

export const getOutputObject = (invocation: ToolPart) => {
  const output = invocation.state?.output;
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  return output as Record<string, unknown>;
};

export const getStringValue = (value: unknown) => {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return null;
};

export const getObjectValue = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const getStateObject = (invocation: ToolPart, key: string) => {
  const state = getObjectValue(invocation.state);
  if (!state) return null;
  return getObjectValue(state[key]);
};

export const getOutputText = (invocation: ToolPart) => {
  const outputObject = getOutputObject(invocation);
  return (
    getStringValue(invocation.state?.output) ??
    getStringValue(outputObject?.returnDisplay) ??
    getStringValue(outputObject?.preview) ??
    getStringValue(outputObject?.stdout)
  );
};

export const prependErrorBlock = (invocation: ToolPart, blocks: Block[]): Block[] => {
  if (!isErrorState(invocation.state?.status) || !invocation.state?.errorText) return blocks;
  const errorBlock: Block = { type: "comment", text: invocation.state.errorText };
  return [errorBlock, ...blocks];
};
