export type ToolShapeKind = "page" | "command" | "editor" | "skill" | "hook" | "automation";

export const TOOL_SHAPE_COLORS: Record<ToolShapeKind, string> = {
  page: "var(--chakra-colors-illustration-page)",
  command: "var(--chakra-colors-illustration-command)",
  editor: "var(--chakra-colors-illustration-editor)",
  skill: "var(--chakra-colors-illustration-skill)",
  hook: "var(--chakra-colors-illustration-hook)",
  automation: "var(--chakra-colors-illustration-automation)",
};

/** Width relative to `size`; the pill and half-disc are wider than they are tall. */
export const TOOL_SHAPE_ASPECT: Record<ToolShapeKind, number> = {
  page: 1,
  command: 88 / 24,
  editor: 1,
  skill: 2,
  hook: 1,
  automation: 1,
};
