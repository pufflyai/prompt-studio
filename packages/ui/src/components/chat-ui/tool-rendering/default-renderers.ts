import type { ToolPart } from "../agent-types";
import type { Block, Item, TitleSegment } from "../components/timeline";
import { basenameSafe, buildDiffTitleSegments, buildFileDiffPreviews, extractDiffFilePaths } from "../utils/diff";
import { toolTypeToIconName } from "../utils/get-icon";
import type { ToolRenderer, ToolRenderersMap } from "./types";

const TOOL_LABELS: Record<string, string> = {
  apply_patch: "Apply patch",
  read: "Read file",
  bash: "Run",
  grep: "Search files",
  glob: "Find files",
  skill: "Load skill",
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

const getToolType = (invocation: ToolPart) => normalizeToolType(invocation.tool ?? "tool");

const getToolLabel = (value: string) => {
  const normalized = normalizeToolType(value);
  return TOOL_LABELS[normalized] ?? toTitleCase(normalized.replace(/_/g, " "));
};

const getStateLabel = (state?: unknown) => {
  if (!state || typeof state !== "string") return null;
  if (STATE_LABELS[state]) return STATE_LABELS[state];
  if (state.includes("stream")) return "running";
  return null;
};

const isErrorState = (state?: string) => state === "error" || state === "output-error";

const buildIndicator = (invocation: ToolPart) => {
  if (isErrorState(invocation.state?.status)) {
    return { type: "icon", icon: "danger" } as const;
  }

  return { type: "icon", icon: toolTypeToIconName(getToolType(invocation)) } as const;
};

const buildBaseTitle = (invocation: ToolPart, detail?: string, labelOverride?: string) => {
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

const normalizeFilePath = (value: string) => value.replace(/\\/g, "/").replace(/^\/+/, "");

const isUnifiedDiff = (value: string) => value.includes("--- ") && value.includes("+++ ") && value.includes("@@");

type ApplyPatchMetadataFile = {
  filePath: string;
  additions: number;
  deletions: number;
  diff?: string;
  before?: string;
  after?: string;
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

const getApplyPatchMetadataFiles = (invocation: ToolPart) => {
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

const buildApplyPatchMetadataTitleSegments = (files: ApplyPatchMetadataFile[]) => {
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

const getApplyPatchMetadataReferences = (files: ApplyPatchMetadataFile[]) => {
  return Array.from(new Set(files.map((file) => file.filePath)));
};

const getOutputText = (invocation: ToolPart) => {
  const outputObject = getOutputObject(invocation);

  return (
    getStringValue(invocation.state?.output) ??
    getStringValue(outputObject?.returnDisplay) ??
    getStringValue(outputObject?.preview) ??
    getStringValue(outputObject?.stdout)
  );
};

const parseSkillContentBlock = (value: string) => {
  const match = value.match(/<skill_content(?:\s+name="([^"]+)")?>([\s\S]*?)<\/skill_content>/);
  if (!match) return null;

  return {
    skillName: getStringValue(match[1]) ?? undefined,
    content: getStringValue(match[2]) ?? "",
  };
};

const getSkillName = (invocation: ToolPart) => {
  const input = getInputObject(invocation);
  return (
    getStringValue(input?.name) ??
    getStringValue(input?.skillName) ??
    getStringValue(input?.skill) ??
    getStringValue(input?.skill_name) ??
    undefined
  );
};

const buildFileLinkSegment = (filePath: string): TitleSegment => {
  return {
    kind: "link",
    text: basenameSafe(filePath),
    filePath,
  };
};

const prependErrorBlock = (invocation: ToolPart, blocks: Block[]): Block[] => {
  if (!isErrorState(invocation.state?.status) || !invocation.state?.errorText) return blocks;
  const errorBlock: Block = { type: "comment", text: invocation.state.errorText };
  return [errorBlock, ...blocks];
};

const renderApplyPatch: ToolRenderer = (invocation) => {
  const diffText = getApplyPatchDiffText(invocation);
  const metadataFiles = getApplyPatchMetadataFiles(invocation);

  const title = buildBaseTitle(invocation, undefined, "Apply patch");
  const diffSegments = buildDiffTitleSegments(diffText ?? undefined);
  if (diffSegments.length > 0) {
    title.push(...diffSegments);
  } else {
    title.push(...buildApplyPatchMetadataTitleSegments(metadataFiles));
  }

  const blocks: Block[] = [];
  const previews = buildFileDiffPreviews(diffText ?? undefined);
  for (const preview of previews) {
    blocks.push({
      type: "diff",
      language: "diff",
      original: preview.original,
      modified: preview.modified,
      sideBySide: false,
    });
  }

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
    if (references.length === 0) {
      references.push(...getApplyPatchMetadataReferences(metadataFiles));
    }
    if (references.length > 0) {
      blocks.push({ type: "references", references });
    }
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};

const renderRead: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const output = getOutputObject(invocation);

  const filePath =
    getStringValue(input?.filePath) ??
    getStringValue(input?.file) ??
    getStringValue(output?.filePath) ??
    getStringValue(output?.file) ??
    getStringValue(output?.path) ??
    undefined;

  const title = buildBaseTitle(invocation, undefined, "Read file");
  if (filePath) {
    title.push(buildFileLinkSegment(filePath));
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, []),
  } satisfies Item;
};

const renderBash: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const output = getOutputObject(invocation);
  const command = getStringValue(input?.command) ?? undefined;

  const title = buildBaseTitle(invocation, command, "Run command");
  const blocks: Block[] = [];

  const outputText = getOutputText(invocation);
  if (outputText) {
    blocks.push({ type: "code", language: "text", code: outputText });
  }

  const stderr = getStringValue(output?.stderr);
  if (stderr && stderr !== outputText) {
    blocks.push({ type: "code", language: "text", code: stderr });
  }

  if (typeof output?.exitCode === "number") {
    blocks.push({ type: "text", text: `Exit code: ${output.exitCode}` });
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};

const renderGrep: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const outputText = getOutputText(invocation);
  const query = getStringValue(input?.pattern) ?? undefined;

  const title = buildBaseTitle(invocation, query, "Search files");
  const blocks: Block[] = outputText ? [{ type: "code", language: "text", code: outputText }] : [];

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};

const renderGlob: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const outputText = getOutputText(invocation);
  const pattern = getStringValue(input?.pattern) ?? undefined;

  const title = buildBaseTitle(invocation, pattern, "Find files");
  const blocks: Block[] = [];

  if (outputText) {
    const references = outputText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (references.length > 0) {
      blocks.push({ type: "references", references });
    }
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};

const renderSkill: ToolRenderer = (invocation) => {
  const outputText = getOutputText(invocation);
  const parsedOutput = outputText ? parseSkillContentBlock(outputText) : null;

  const skillName = getSkillName(invocation) ?? parsedOutput?.skillName;
  const title = buildBaseTitle(invocation, skillName, "Load skill");

  const renderedContent = parsedOutput?.content ?? outputText;
  const blocks: Block[] = renderedContent ? [{ type: "code", language: "markdown", code: renderedContent }] : [];

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};

export const createDefaultToolRenderers = () => {
  return {
    apply_patch: renderApplyPatch,
    read: renderRead,
    bash: renderBash,
    grep: renderGrep,
    glob: renderGlob,
    skill: renderSkill,
  } satisfies ToolRenderersMap;
};
