import { TOOL_SHAPE_ASPECT, type ToolShapeKind } from "./tool-shapes";

export interface FieldSize {
  width: number;
  height: number;
}
export interface FieldWall {
  cx: number;
  cy: number;
  width: number;
  height: number;
  angle: number;
}
export interface FieldPiece {
  id: string;
  kind: ToolShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
}

interface ToolPlacement {
  horizontal: number;
  angle: number;
}

const TOOLS: ToolShapeKind[] = [
  "page",
  "command",
  "automation",
  "skill",
  "page",
  "hook",
  "editor",
  "command",
  "page",
  "automation",
  "page",
  "hook",
  "command",
  "editor",
  "automation",
  "skill",
  "page",
  "automation",
  "skill",
  "page",
  "command",
  "hook",
];
const HEIGHTS: Record<ToolShapeKind, number> = {
  page: 76,
  command: 28,
  automation: 46,
  skill: 40,
  hook: 54,
  editor: 64,
};

export const INITIAL_TOOL_COUNT = 6;
export const MAX_TOOL_COUNT = 30;
export const TOOL_SPAWN_INTERVAL = 3000;

export const randomToolPlacement = () => ({ horizontal: Math.random(), angle: (Math.random() * 2 - 1) * Math.PI });

export const containerPiece = (size: FieldSize, index: number, placement: ToolPlacement, settled = false) => {
  const scale = Math.min(1.35, (size.width - 24) / 630);
  const kind = TOOLS[index % TOOLS.length];
  const height = HEIGHTS[kind] * scale;
  const width = height * TOOL_SHAPE_ASPECT[kind];
  const { horizontal, angle } = placement;
  const halfWidth = (width * Math.abs(Math.cos(angle)) + height * Math.abs(Math.sin(angle))) / 2;
  const halfHeight = (width * Math.abs(Math.sin(angle)) + height * Math.abs(Math.cos(angle))) / 2;
  return {
    id: `tool-${index}`,
    kind,
    x: halfWidth + horizontal * (size.width - halfWidth * 2) - width / 2,
    y: (settled ? size.height - halfHeight : -halfHeight) - height / 2,
    width,
    height,
    angle,
  };
};

export const containerLayout = (size: FieldSize, placements: ToolPlacement[]) => {
  if (size.width <= 0 || size.height <= 0) return { pieces: [], walls: [] };
  const pieces = placements.map((placement, index) => containerPiece(size, index, placement, true));
  return { pieces, walls: [] };
};

/** A measured line of text the shapes rest on, plus the shapes that start there. */
export interface Perch {
  x: number;
  y: number;
  width: number;
  marks: ToolShapeKind[];
}

const PERCH_THICKNESS = 6;
const MARK_GAP = 9;
const MARK_INSET = 16;

/** Big enough to read as objects sitting on the line, small enough not to cover it. */
const MARK_HEIGHT: Record<ToolShapeKind, number> = {
  page: 30,
  command: 20,
  editor: 30,
  skill: 26,
  hook: 28,
  automation: 26,
};

export const parcourLayout = (perches: Perch[]) => {
  // Never drawn: on this page the title itself is what the shapes appear to rest on.
  const walls = perches.map((perch) => ({
    cx: perch.x + perch.width / 2,
    cy: perch.y - PERCH_THICKNESS / 2,
    width: perch.width,
    height: PERCH_THICKNESS,
    angle: 0,
  }));

  const pieces = perches.flatMap((perch, perchIndex) => {
    const marks = perch.marks.map((kind) => ({
      kind,
      height: MARK_HEIGHT[kind],
      width: MARK_HEIGHT[kind] * TOOL_SHAPE_ASPECT[kind],
    }));
    const span = marks.reduce((total, mark) => total + mark.width + MARK_GAP, -MARK_GAP);
    const start = Math.max(perch.x, perch.x + perch.width - MARK_INSET - span);

    return marks.map((mark, index) => ({
      id: `perch-${perchIndex}-${index}`,
      kind: mark.kind,
      x: start + marks.slice(0, index).reduce((total, prior) => total + prior.width + MARK_GAP, 0),
      y: perch.y - PERCH_THICKNESS - mark.height,
      width: mark.width,
      height: mark.height,
      angle: 0,
    }));
  });

  return { pieces, walls };
};
