import type { ToolPart } from "../components/message-types";
import type { Block, Item, TitleSegment } from "../components/timeline";
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

const isBlankValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0 || value.every(isBlankValue);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isBlankValue);
  }
  return false;
};

const getRecord = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const getString = (value: unknown) => {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return null;
};

const getMediaType = (record: Record<string, unknown>) =>
  getString(record.mime_type) ?? getString(record.mediaType) ?? getString(record.mimeType);

const isImageMediaType = (value: string | null) => Boolean(value?.startsWith("image/"));

const imageUrlPattern = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?.*)?$/i;

const getImageBlock = (value: unknown, alt: string): Block | null => {
  const record = getRecord(value);
  if (!record) return null;

  const mediaType = getMediaType(record);
  const data = getString(record.data);
  if (data && isImageMediaType(mediaType)) {
    return { type: "image", src: `data:${mediaType};base64,${data}`, alt };
  }

  const url = getString(record.url) ?? getString(record.src);
  if (url && (isImageMediaType(mediaType) || imageUrlPattern.test(url))) {
    return { type: "image", src: url, alt };
  }

  return null;
};

const getFileLikeOutput = (value: unknown) => {
  const record = getRecord(value);
  if (!record) return null;

  const filePath = getString(record.path) ?? getString(record.filePath) ?? getString(record.filename);
  const content = getString(record.content) ?? getString(record.body) ?? getString(record.text);
  if (!filePath || content === null) return null;

  return { filePath, content };
};

const extensionLanguageBySuffix: Record<string, string> = {
  css: "css",
  html: "html",
  js: "js",
  json: "json",
  jsx: "jsx",
  md: "markdown",
  py: "python",
  ts: "ts",
  tsx: "tsx",
  yaml: "yaml",
  yml: "yaml",
};

const getLanguageFromPath = (filePath: string) => {
  const extension = filePath.split(".").pop()?.toLowerCase();
  if (!extension) return "text";
  return extensionLanguageBySuffix[extension] ?? extension;
};

const createLabeledBlocks = (label: string, blocks: Block[]) => {
  if (blocks.length === 0) return [];
  return [{ type: "text", text: label }, ...blocks] satisfies Block[];
};

const buildBlocksForArrayValue = (value: unknown[], alt: string) => {
  const blocks: Block[] = [];

  for (const entry of value) {
    const entryRecord = getRecord(entry);
    const entryType = getString(entryRecord?.type);
    if (entryType === "image") {
      const image = getImageBlock(entry, alt);
      if (image) blocks.push(image);
      continue;
    }
    if (entryType === "text") {
      const text = getString(entryRecord?.text);
      if (text) blocks.push({ type: "text", text });
      continue;
    }
    blocks.push(...buildBlocksForValue(entry, alt));
  }

  return blocks;
};

const buildBlocksForFileLikeValue = (value: unknown) => {
  const fileLikeOutput = getFileLikeOutput(value);
  if (!fileLikeOutput) return null;

  return [
    {
      type: "code",
      language: getLanguageFromPath(fileLikeOutput.filePath),
      code: fileLikeOutput.content,
    },
  ] satisfies Block[];
};

const buildBlocksForAttachmentValue = (value: unknown) => {
  const record = getRecord(value);
  const attachmentName = getString(record?.attachment_name) ?? getString(record?.attachmentName);
  const attachmentId = getString(record?.attachment_file_id) ?? getString(record?.attachmentFileId);
  if (!attachmentName && !attachmentId) return null;

  return [{ type: "text", text: attachmentName ?? `Attachment ${attachmentId}` }] satisfies Block[];
};

const buildBlocksForValue = (value: unknown, alt: string): Block[] => {
  if (isBlankValue(value)) return [];

  const imageBlock = getImageBlock(value, alt);
  if (imageBlock) return [imageBlock];

  if (Array.isArray(value)) return buildBlocksForArrayValue(value, alt);

  const fileBlocks = buildBlocksForFileLikeValue(value);
  if (fileBlocks) return fileBlocks;

  const attachmentBlocks = buildBlocksForAttachmentValue(value);
  if (attachmentBlocks) return attachmentBlocks;

  const text = stringifyValue(value);
  if (!text?.trim()) return [];

  return [{ type: "code", language: typeof value === "string" ? "text" : "json", code: text }] satisfies Block[];
};

const buildGenericBlocks = (invocation: ToolPart): Block[] => {
  const blocks: Block[] = [];
  const toolLabel = getToolLabel(invocation.tool);

  if (isErrorState(invocation.state?.status) && invocation.state?.errorText) {
    blocks.push({ type: "comment", text: invocation.state.errorText });
  }

  blocks.push(...createLabeledBlocks("Input", buildBlocksForValue(invocation.state?.input, `${toolLabel} input`)));
  blocks.push(...createLabeledBlocks("Output", buildBlocksForValue(invocation.state?.output, `${toolLabel} output`)));

  return blocks;
};

const createGenericItem = (invocation: ToolPart) => {
  const title: TitleSegment[] = [{ kind: "text", text: getToolLabel(invocation.tool), bold: true }];
  const fileLikeOutput = getFileLikeOutput(invocation.state?.output);
  if (fileLikeOutput) {
    title.push({ kind: "link", text: fileLikeOutput.filePath, filePath: fileLikeOutput.filePath });
  }
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

const isVisibleTitleSegment = (segment: TitleSegment) => {
  if (segment.kind === "text" || segment.kind === "link") return segment.text.trim().length > 0;
  if (segment.kind === "diff") return segment.fileName.trim().length > 0;
  return true;
};

const isVisibleBlock = (block: Block) => {
  switch (block.type) {
    case "comment":
    case "code":
    case "text":
      return block.type === "code" ? block.code.trim().length > 0 : block.text.trim().length > 0;
    case "diff":
      return block.original.trim().length > 0 || block.modified.trim().length > 0;
    case "image":
      return block.src.trim().length > 0;
    case "todo-list":
      return block.items.length > 0;
    case "question-form":
      return block.questions.length > 0;
    case "references":
      return block.references.length > 0;
    case "input":
    case "component":
      return true;
  }
};

const isVisibleItem = (item: Item) => {
  const hasTitle = item.title.some(isVisibleTitleSegment);
  const hasBlocks = (item.blocks ?? []).some(isVisibleBlock);
  return hasTitle || hasBlocks;
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
  const items = invocations
    .map((invocation) => renderInvocation(invocation, toolRenderers, options))
    .filter(isVisibleItem);

  return { items };
};
