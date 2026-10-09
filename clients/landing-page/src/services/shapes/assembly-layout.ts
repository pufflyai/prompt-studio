import { ASSEMBLY_EXAMPLES, ASSEMBLY_KINDS, ASSEMBLY_SHAPE_HEIGHTS, LOOSE_PIECES } from "../../content/tool-assembly";
import { TOOL_SHAPE_ASPECT, type ToolShapeKind } from "../../content/tool-shapes";

export interface FieldSize {
  width: number;
  height: number;
}
export interface AssemblySlot {
  id: string;
  kind: ToolShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
}
export const DEFAULT_FIELD_SIZE = { width: 1200, height: 900 };
export const DEFAULT_COPY_SIZE = { width: 480, height: 672 };
export const cursorStart = (width: number, index: number) => ({ x: width + 80 + index * 40, y: 80 + index * 70 });
export const BOARD_WIDTH = 640;
export const BOARD_HEIGHT = 462;
export const SLOT_TRAY_HEIGHT = 78;
export const BOARD_PREVIEW_HEIGHT = BOARD_HEIGHT - SLOT_TRAY_HEIGHT;
const PILE_CLEARANCE = 140;
export const BOARD_SCALE = { wide: 0.85, narrow: 0.95 };
export interface BoardLayout {
  x: number;
  y: number;
  scale: number;
  /** Match the SVG reference dimensions to the theme's rem-based controls. */
  unitScale: number;
}
const slotDimensions = (kind: ToolShapeKind) => ({
  height: ASSEMBLY_SHAPE_HEIGHTS[kind] * 1.2,
  width: ASSEMBLY_SHAPE_HEIGHTS[kind] * TOOL_SHAPE_ASPECT[kind] * 1.2,
});
const MAX_SLOT_COUNT = Math.max(...ASSEMBLY_EXAMPLES.map((example) => example.blocks.length));
const MAX_SLOT_WIDTH = Math.max(
  ...ASSEMBLY_EXAMPLES.map((example) =>
    example.blocks.reduce((width, block) => width + slotDimensions(block.kind).width, 0),
  ),
);

/** Slots and shapes keep their physical size while the editor scales to fit. */
export const boardSlots = (board: BoardLayout, example = ASSEMBLY_EXAMPLES[0]) => {
  const usedWidth = example.blocks.reduce((width, block) => width + slotDimensions(block.kind).width, 0);
  // Every tool uses the same board and spacing reserved for the largest combination.
  const width = BOARD_WIDTH * board.unitScale * board.scale;
  const gap = (width - MAX_SLOT_WIDTH) / (MAX_SLOT_COUNT + 1);
  const start = (width - usedWidth - gap * (example.blocks.length + 1)) / 2;
  return ASSEMBLY_KINDS.map((kind) => {
    const index = example.blocks.findIndex((block) => block.kind === kind);
    const { width, height } = slotDimensions(kind);
    const before = example.blocks
      .slice(0, Math.max(0, index))
      .reduce((sum, block) => sum + slotDimensions(block.kind).width, 0);
    return {
      id: kind,
      kind,
      x: board.x + start + before + gap * (Math.max(0, index) + 1) + width / 2,
      y: board.y + BOARD_PREVIEW_HEIGHT * board.unitScale * board.scale + SLOT_TRAY_HEIGHT / 2,
      width,
      height,
    };
  });
};

export const assemblyLayout = (
  size: FieldSize,
  copy = DEFAULT_COPY_SIZE,
  example = ASSEMBLY_EXAMPLES[0],
  unitScale = 1,
) => {
  const wide = size.width >= 864 * unitScale;
  const available = wide ? size.width - copy.width - 48 : size.width - 32;
  const y = wide ? 24 : copy.height + 24;
  // Grow the whole editor with its container, leaving physical space for the slot tray and pile.
  const previewHeight = Math.max(1, size.height - y - SLOT_TRAY_HEIGHT - PILE_CLEARANCE);
  const scale =
    (wide ? BOARD_SCALE.wide : BOARD_SCALE.narrow) *
    Math.min(available / (BOARD_WIDTH * unitScale), previewHeight / (BOARD_PREVIEW_HEIGHT * unitScale));
  const width = BOARD_WIDTH * unitScale * scale;
  const x = wide ? copy.width + 24 + (available - width) / 2 : (size.width - width) / 2;
  const board = { x, y, scale, unitScale };
  return { board, slots: boardSlots(board, example) };
};

export const fieldPieces = (size: FieldSize, board = assemblyLayout(size).board) => {
  const center = board.x + (BOARD_WIDTH * board.unitScale * board.scale) / 2;
  return LOOSE_PIECES.map((piece) => ({
    ...piece,
    source: {
      ...piece.source,
      x: center + piece.source.x,
      y: size.height + piece.source.y,
    },
  }));
};
