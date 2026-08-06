import type { Block, Item } from "../components/timeline";
import {
  buildBaseTitle,
  buildFileLinkSegment,
  buildIndicator,
  getInputObject,
  getOutputObject,
  getOutputText,
  getSkillName,
  getStringValue,
  parseSkillContentBlock,
  prependErrorBlock,
} from "./shared";
import type { ToolRenderer } from "./types";

export const renderRead: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const output = getOutputObject(invocation);

  const filePath =
    getStringValue(input?.filePath) ??
    getStringValue(input?.file_path) ??
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

const renderCommand = (invocation: Parameters<ToolRenderer>[0], label: string) => {
  const input = getInputObject(invocation);
  const output = getOutputObject(invocation);
  const command = getStringValue(input?.command) ?? undefined;

  const title = buildBaseTitle(invocation, command, label, "monospace");
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

export const renderBash: ToolRenderer = (invocation) => renderCommand(invocation, "Run command");

export const renderShell: ToolRenderer = (invocation) => renderCommand(invocation, "Shell");

export const renderGrep: ToolRenderer = (invocation) => {
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

export const renderGlob: ToolRenderer = (invocation) => {
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

export const renderSkill: ToolRenderer = (invocation) => {
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
