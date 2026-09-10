import { TOOL_SHAPE_ASPECT, TOOL_SHAPE_COLORS, type ToolShapeKind } from "../../content/tool-shapes";
import { crossPath, halfDiscPath } from "../../services/shapes/tool-shape-geometry";

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
      <svg width={width} height={size} viewBox={`0 0 ${width} ${size}`} aria-hidden="true" focusable="false">
        <path d={halfDiscPath(width, size)} fill={color} />
      </svg>
    );
  }

  if (kind === "hook") {
    return (
      <svg width={width} height={size} viewBox={`0 0 ${width} ${size}`} aria-hidden="true" focusable="false">
        <path d={crossPath(width, size)} fill={color} />
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
