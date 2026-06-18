import type { ToolPart } from "../components/message-types";
import type { Block, TitleSegment } from "../components/timeline";
import { basenameSafe, buildDiffTitleSegments, buildFileDiffPreviews, extractDiffFilePaths } from "../utils/diff";
import { toolTypeToIconName } from "../utils/get-icon";

const TOOL_LABELS: Record<string, string> = {
  apply_patch: "Apply patch",
  bash: "Run command",
  edit: "Edit file",
  glob: "Find files",
  grep: "Search files",
  read: "Read file",
  skill: "Load skill",
  todowrite: "Update todos",
};

const STATE_LABELS: Record<string, string> = {
  pending: "queued",
  error: "failed",
  "output-error": "failed",
  input_streaming: "running",
  input_available: "queued",
  running: "running",
  completed: "completed",
  failed: "failed",
};

export type ApplyPatchMetadataFile = {
  filePath: string;
  additions: number;
  deletions: number;
  diff?: string;
  before?: string;
  after?: string;
};

export const normalizeToolType = (value: string) => value.replace(/^tool-/, "").toLowerCase();

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

export const getStateLabel = (invocation: ToolPart) => {
  const state = invocation.state?.status ?? invocation.status;
  if (!state || typeof state !== "string") return null;

  const normalized = state.replace(/-/g, "_");
  if (STATE_LABELS[normalized]) return STATE_LABELS[normalized];
  if (normalized.includes("stream")) return "running";
  return null;
};

export const isErrorState = (invocation: ToolPart) => {
  const state = invocation.state?.status ?? invocation.status;
  return state === "error" || state === "output-error" || state === "failed";
};

export const buildIndicator = (invocation: ToolPart) => {
  if (isErrorState(invocation)) {
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

  const stateLabel = getStateLabel(invocation);
  if (stateLabel && stateLabel !== "completed") {
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

const normalizeFilePath = (value: string) => value.replace(/\\/g, "/").replace(/^\/+/, "");

const isUnifiedDiff = (value: string) => value.includes("--- ") && value.includes("+++ ") && value.includes("@@");

const getApplyPatchMetadataObjects = (invocation: ToolPart) => {
  const output = getOutputObject(invocation);
  return [getStateObject(invocation, "metadata"), getObjectValue(output?.metadata)].filter(Boolean) as Array<
    Record<string, unknown>
  >;
};

const parseApplyPatchMetadataFile = (entry: unknown) => {
  const record = getObjectValue(entry);
  if (!record) return null;

  const rawPath = getStringValue(record.filePath) ?? getStringValue(record.relativePath) ?? getStringValue(record.path);
  if (!rawPath) return null;

  return {
    filePath: normalizeFilePath(rawPath),
    additions: typeof record.additions === "number" ? record.additions : 0,
    deletions: typeof record.deletions === "number" ? record.deletions : 0,
    diff: getStringValue(record.diff) ?? undefined,
    before: getStringValue(record.before) ?? undefined,
    after: getStringValue(record.after) ?? undefined,
  } satisfies ApplyPatchMetadataFile;
};

export const getApplyPatchMetadataFiles = (invocation: ToolPart) => {
  const files: ApplyPatchMetadataFile[] = [];

  for (const metadata of getApplyPatchMetadataObjects(invocation)) {
    const entries = Array.isArray(metadata.files) ? metadata.files : [];

    for (const entry of entries) {
      const parsedFile = parseApplyPatchMetadataFile(entry);
      if (!parsedFile) continue;
      files.push(parsedFile);
    }
  }

  return files;
};

export const getApplyPatchDiffText = (invocation: ToolPart) => {
  const input = getInputObject(invocation);
  const inputDiff = getStringValue(input?.diff);
  if (inputDiff) return inputDiff;

  for (const metadata of getApplyPatchMetadataObjects(invocation)) {
    const metadataDiff = getStringValue(metadata.diff);
    if (metadataDiff) return metadataDiff;
  }

  const fileDiffs = getApplyPatchMetadataFiles(invocation)
    .map((file) => file.diff)
    .filter((diff): diff is string => Boolean(diff));
  if (fileDiffs.length > 0) return fileDiffs.join("\n");

  const patchText = getStringValue(input?.patchText);
  if (patchText && isUnifiedDiff(patchText)) return patchText;

  return null;
};

export const buildApplyPatchMetadataTitleSegments = (files: ApplyPatchMetadataFile[]) => {
  const seen = new Set<string>();
  const segments: TitleSegment[] = [];

  for (const file of files) {
    if (seen.has(file.filePath)) continue;
    seen.add(file.filePath);

    segments.push({
      kind: "diff",
      fileName: basenameSafe(file.filePath),
      filePath: file.filePath,
      additions: file.additions,
      deletions: file.deletions,
    });
  }

  return segments;
};

export const getApplyPatchMetadataReferences = (files: ApplyPatchMetadataFile[]) => {
  return Array.from(new Set(files.map((file) => file.filePath)));
};

export const getOutputText = (invocation: ToolPart) => {
  const outputObject = getOutputObject(invocation);

  return (
    getStringValue(invocation.state?.output) ??
    getStringValue(outputObject?.returnDisplay) ??
    getStringValue(outputObject?.preview) ??
    getStringValue(outputObject?.stdout) ??
    getStringValue(outputObject?.content)
  );
};

export const parseSkillContentBlock = (value: string) => {
  const match = value.match(/<skill_content(?:\s+name="([^"]+)")?>([\s\S]*?)<\/skill_content>/);
  if (!match) return null;

  return {
    skillName: getStringValue(match[1]) ?? undefined,
    content: getStringValue(match[2]) ?? "",
  };
};

export const getSkillName = (invocation: ToolPart) => {
  const input = getInputObject(invocation);
  return (
    getStringValue(input?.name) ??
    getStringValue(input?.skillName) ??
    getStringValue(input?.skill) ??
    getStringValue(input?.skill_name) ??
    undefined
  );
};

export const buildFileLinkSegment = (filePath: string): TitleSegment => {
  return {
    kind: "link",
    text: basenameSafe(filePath),
    filePath,
  };
};

export const prependErrorBlock = (invocation: ToolPart, blocks: Block[]): Block[] => {
  if (!isErrorState(invocation) || !invocation.state?.errorText) return blocks;
  const errorBlock: Block = { type: "comment", text: invocation.state.errorText };
  return [errorBlock, ...blocks];
};

export const getDiffBlocks = (diffText?: string | null) => {
  return buildFileDiffPreviews(diffText ?? undefined).map((preview) => ({
    type: "diff",
    language: "diff",
    original: preview.original,
    modified: preview.modified,
    sideBySide: false,
  })) satisfies Block[];
};

export const getDiffTitleSegments = (diffText?: string | null) => buildDiffTitleSegments(diffText ?? undefined);

export const getDiffReferences = (diffText?: string | null) => extractDiffFilePaths(diffText ?? undefined);
