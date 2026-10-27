import { composeStory } from "@storybook/react";
import type { ComponentType } from "react";

declare const __UI_CANVAS_MODULES__: Record<string, () => Promise<Record<string, unknown>>>;
declare const __UI_CANVAS_PROJECTS__: Record<string, () => Promise<{ default: Record<string, unknown> }>>;

interface PreviewInput {
  kind: string;
  suite: string;
  source: string;
  exportName?: string;
}

export const loadPreview = async (input: PreviewInput) => {
  const module = await __UI_CANVAS_MODULES__[input.source]?.();
  if (!module) throw new Error(`Missing preview source: ${input.source}`);
  if (input.kind === "document") return { Component: module.default as ComponentType };
  const project = (await __UI_CANVAS_PROJECTS__[input.suite]()).default;
  const exportName = input.exportName!;
  if (!module[exportName]) throw new Error(`Missing preview: ${input.source}#${exportName}`);
  const story = composeStory(
    module[exportName] as Parameters<typeof composeStory>[0],
    module.default as Parameters<typeof composeStory>[1],
    project,
    exportName,
  );
  await story.load();
  return {
    Component: story as ComponentType,
    args: story.args,
    argTypes: story.argTypes,
    parameters: story.parameters,
    hasPlay: typeof story.play === "function",
  };
};
