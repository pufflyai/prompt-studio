/**
 * The illustration vocabulary: one primitive per extension contribution type, so a
 * cluster of shapes reads as a specific toolset rather than decoration. The Prompt
 * Studio mark is deliberately not in this set - the logo is the logo.
 */
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

interface ToolShapeProps {
  kind: ToolShapeKind;
  size: number;
  /** Overrides the aspect default, so shelf items can match the design exactly. */
  width?: number;
}

export const ToolShape = (props: ToolShapeProps) => {
  const { kind, size } = props;
  const width = props.width ?? size * TOOL_SHAPE_ASPECT[kind];
  const color = TOOL_SHAPE_COLORS[kind];

  if (kind === "command") {
    return (
      <svg width={width} height={size} viewBox="0 0 88 24" aria-hidden="true" focusable="false">
        <rect x="0" y="0" width="88" height="24" rx="12" fill={color} />
      </svg>
    );
  }

  if (kind === "skill") {
    return (
      <svg width={width} height={size} viewBox="0 0 26 13" aria-hidden="true" focusable="false">
        <path d="M0 13A13 13 0 0 1 26 13Z" fill={color} />
      </svg>
    );
  }

  if (kind === "hook") {
    return (
      <svg width={width} height={size} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
        <path d="M10 0h6v10h10v6H16v10h-6V16H0v-6h10z" fill={color} />
      </svg>
    );
  }

  if (kind === "automation") {
    return (
      <svg width={width} height={size} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
        <circle cx="13" cy="13" r="13" fill={color} />
      </svg>
    );
  }

  if (kind === "editor") {
    return (
      <svg width={width} height={size} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
        <rect x="2.5" y="2.5" width="21" height="21" rx="6" fill="none" stroke={color} strokeWidth="5" />
      </svg>
    );
  }

  return (
    <svg width={width} height={size} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="26" height="26" rx="7.5" fill={color} />
    </svg>
  );
};
