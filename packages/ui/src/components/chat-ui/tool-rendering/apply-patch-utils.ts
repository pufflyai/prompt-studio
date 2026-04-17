import type { ToolPart } from "../agent-types";
import type { TitleSegment } from "../components/timeline";
import { basenameSafe } from "../utils/diff";

export type ApplyPatchMetadataFile = {
  filePath: string;
  additions: number;
  deletions: number;
  diff?: string;
  before?: string;
  after?: string;
};

const normalizeFilePath = (value: string) => value.replace(/\\/g, "/").replace(/^\/+/, "");

const isUnifiedDiff = (value: string) => value.includes("--- ") && value.includes("+++ ") && value.includes("@@");

const getInputObject = (invocation: ToolPart) => {
  const input = invocation.state?.input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as Record<string, unknown>;
};

const getOutputObject = (invocation: ToolPart) => {
  const output = invocation.state?.output;
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  return output as Record<string, unknown>;
};

const getStringValue = (value: unknown) => {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return null;
};

const getObjectValue = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const getStateObject = (invocation: ToolPart, key: string) => {
  const state = getObjectValue(invocation.state);
  if (!state) return null;
  return getObjectValue(state[key]);
};

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
