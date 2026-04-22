import type { ToolPart } from "../agent-types";
import { buildDiffTitleSegments, buildFileDiffPreviews, extractDiffFilePaths } from "../utils/diff";
import {
  buildBaseTitle,
  createItem,
  getInputObject,
  getObjectValue,
  getStateObject,
  getStringValue,
  normalizeFilePath,
} from "./shared";
import type { ToolRenderer } from "./types";

type ApplyPatchMetadataFile = {
  filePath: string;
  additions: number;
  deletions: number;
  diff?: string;
  before?: string;
  after?: string;
};

const isUnifiedDiff = (value: string) => value.includes("--- ") && value.includes("+++ ") && value.includes("@@");

const getApplyPatchMetadataObjects = (invocation: ToolPart) => {
  const output = getObjectValue(invocation.state?.output);
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

const getApplyPatchMetadataFiles = (invocation: ToolPart) => {
  const files: ApplyPatchMetadataFile[] = [];

  for (const metadata of getApplyPatchMetadataObjects(invocation)) {
    const entries = Array.isArray(metadata.files) ? metadata.files : [];
    for (const entry of entries) {
      const parsed = parseApplyPatchMetadataFile(entry);
      if (parsed) files.push(parsed);
    }
  }

  return files;
};

const getApplyPatchDiffText = (invocation: ToolPart) => {
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

const buildMetadataTitleSegments = (files: ApplyPatchMetadataFile[]) => {
  const seen = new Set<string>();
  return files.flatMap((file) => {
    if (seen.has(file.filePath)) return [];
    seen.add(file.filePath);
    return [
      {
        kind: "diff",
        fileName: file.filePath.split("/").at(-1) ?? file.filePath,
        filePath: file.filePath,
        additions: file.additions,
        deletions: file.deletions,
      },
    ] as const;
  });
};

const getMetadataReferences = (files: ApplyPatchMetadataFile[]) => {
  return Array.from(new Set(files.map((file) => file.filePath)));
};

export const renderApplyPatch: ToolRenderer = (invocation) => {
  const diffText = getApplyPatchDiffText(invocation);
  const metadataFiles = getApplyPatchMetadataFiles(invocation);
  const title = buildBaseTitle(invocation, undefined, "Apply patch");
  const diffSegments = buildDiffTitleSegments(diffText ?? undefined);

  if (diffSegments.length > 0) {
    title.push(...diffSegments);
  } else {
    title.push(...buildMetadataTitleSegments(metadataFiles));
  }

  const blocks: Array<
    | { type: "diff"; language: string; original: string; modified: string; sideBySide: boolean }
    | { type: "references"; references: string[] }
  > = buildFileDiffPreviews(diffText ?? undefined).map((preview) => ({
    type: "diff",
    language: "diff",
    original: preview.original,
    modified: preview.modified,
    sideBySide: false,
  }));

  if (blocks.length === 0) {
    for (const file of metadataFiles) {
      if (!file.before && !file.after) continue;
      blocks.push({
        type: "diff",
        language: "diff",
        original: file.before ?? "",
        modified: file.after ?? "",
        sideBySide: false,
      });
    }
  }

  if (blocks.length === 0) {
    const references = extractDiffFilePaths(diffText ?? undefined);
    if (references.length === 0) references.push(...getMetadataReferences(metadataFiles));
    if (references.length > 0) blocks.push({ type: "references", references });
  }

  return createItem(invocation, title, blocks);
};
