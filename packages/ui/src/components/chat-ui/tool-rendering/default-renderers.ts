import { renderApplyPatch } from "./apply-patch-renderer";
import {
  buildBaseTitle,
  buildFileLinkSegment,
  createItem,
  getArrayValue,
  getInputObject,
  getObjectValue,
  getOutputText,
  getStringValue,
  normalizeFilePath,
} from "./shared";
import type { ToolRenderer, ToolRenderersMap } from "./types";

const parseSkillContentBlock = (value: string) => {
  const match = value.match(/<skill_content(?:\s+name="([^"]+)")?>([\s\S]*?)<\/skill_content>/);
  if (!match) return null;

  return {
    skillName: getStringValue(match[1]) ?? undefined,
    content: getStringValue(match[2]) ?? "",
  };
};

const getSkillName = (input: Record<string, unknown> | null) => {
  return (
    getStringValue(input?.name) ??
    getStringValue(input?.skillName) ??
    getStringValue(input?.skill) ??
    getStringValue(input?.skill_name) ??
    undefined
  );
};

const renderRead: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const output = getObjectValue(invocation.state?.output);
  const metadata = getObjectValue(invocation.state?.metadata);
  const filePath =
    getStringValue(input?.filePath) ??
    getStringValue(input?.file) ??
    getStringValue(output?.filePath) ??
    getStringValue(output?.file) ??
    getStringValue(output?.path) ??
    getStringValue(metadata?.filePath) ??
    undefined;

  const title = buildBaseTitle(invocation, undefined, "Read file");
  if (filePath) title.push(buildFileLinkSegment(filePath));
  return createItem(invocation, title, []);
};

const renderEdit: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const metadata = getObjectValue(invocation.state?.metadata);
  const structuredPatch = getObjectValue(metadata?.structuredPatch);
  const filePath =
    getStringValue(input?.file_path) ??
    getStringValue(input?.filePath) ??
    getStringValue(structuredPatch?.filePath) ??
    undefined;
  const before =
    getStringValue(input?.old_string) ??
    getStringValue(input?.oldString) ??
    getStringValue(structuredPatch?.oldString) ??
    "";
  const after =
    getStringValue(input?.new_string) ??
    getStringValue(input?.newString) ??
    getStringValue(structuredPatch?.newString) ??
    "";

  const title = buildBaseTitle(invocation, undefined, "Edit file");
  if (filePath) title.push(buildFileLinkSegment(normalizeFilePath(filePath)));

  const blocks =
    before || after
      ? [{ type: "diff" as const, language: "diff", original: before, modified: after, sideBySide: false }]
      : [];
  return createItem(invocation, title, blocks);
};

const renderBash: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const output = getObjectValue(invocation.state?.output);
  const metadata = getObjectValue(invocation.state?.metadata);
  const command = getStringValue(input?.command) ?? undefined;
  const title = buildBaseTitle(invocation, command, "Run command");
  const blocks = [] as Array<{ type: "code"; language: string; code: string } | { type: "text"; text: string }>;
  const outputText = getOutputText(invocation);

  if (outputText) blocks.push({ type: "code", language: "text", code: outputText });

  const stderr = getStringValue(output?.stderr) ?? getStringValue(metadata?.stderr);
  if (stderr && stderr !== outputText) blocks.push({ type: "code", language: "text", code: stderr });

  const exitCode =
    typeof output?.exitCode === "number"
      ? output.exitCode
      : typeof metadata?.exitCode === "number"
        ? metadata.exitCode
        : undefined;
  if (exitCode !== undefined) blocks.push({ type: "text", text: `Exit code: ${exitCode}` });

  return createItem(invocation, title, blocks);
};

const renderGrep: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const query = getStringValue(input?.pattern) ?? undefined;
  const outputText = getOutputText(invocation);
  const blocks = outputText ? [{ type: "code" as const, language: "text", code: outputText }] : [];
  return createItem(invocation, buildBaseTitle(invocation, query, "Search files"), blocks);
};

const renderGlob: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const pattern = getStringValue(input?.pattern) ?? undefined;
  const outputText = getOutputText(invocation);
  const references = outputText
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const blocks = references && references.length > 0 ? [{ type: "references" as const, references }] : [];
  return createItem(invocation, buildBaseTitle(invocation, pattern, "Find files"), blocks);
};

const renderTodoWrite: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const metadata = getObjectValue(invocation.state?.metadata);
  const todos = getArrayValue(input?.todos) ?? getArrayValue(metadata?.newTodos) ?? [];
  const blocks = todos.flatMap((todo) => {
    const item = getObjectValue(todo);
    const content = getStringValue(item?.content);
    if (!content) return [];
    const status = getStringValue(item?.status) ?? "pending";
    const priority = getStringValue(item?.priority) ?? "medium";
    return [{ type: "text" as const, text: `${status} | ${priority} | ${content}` }];
  });

  return createItem(invocation, buildBaseTitle(invocation, undefined, "Update todos"), blocks);
};

const renderSkill: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const outputText = getOutputText(invocation);
  const parsedOutput = outputText ? parseSkillContentBlock(outputText) : null;
  const title = buildBaseTitle(invocation, getSkillName(input) ?? parsedOutput?.skillName, "Load skill");
  const renderedContent = parsedOutput?.content ?? outputText;
  const blocks = renderedContent ? [{ type: "code" as const, language: "markdown", code: renderedContent }] : [];
  return createItem(invocation, title, blocks);
};

export const createDefaultToolRenderers = () => {
  return {
    apply_patch: renderApplyPatch,
    bash: renderBash,
    edit: renderEdit,
    glob: renderGlob,
    grep: renderGrep,
    read: renderRead,
    skill: renderSkill,
    todo_write: renderTodoWrite,
  } satisfies ToolRenderersMap;
};
