import { SETTLED_SHAPE_POSITIONS } from "./settled-shape-positions";
import { TOOL_EXAMPLES, type ToolExampleId } from "./tool-examples-content";
import { TOOL_SHAPE_ASPECT, type ToolShapeKind } from "./tool-shapes";

export const ASSEMBLY_EXAMPLES = ["icons", "shaders", "agents", "formulas"].map(
  (id) => TOOL_EXAMPLES.find((example) => example.id === id)!,
);
export const ASSEMBLY_KINDS: ToolShapeKind[] = ["page", "editor", "command", "skill", "hook", "automation"];
export const ASSEMBLY_AGENTS = ["Claude", "Codex", "OpenCode"] as const;

export interface AssemblyView {
  example: ToolExampleId;
  parts: ToolShapeKind[];
}

export interface AssemblyPiece {
  id: string;
  kind: ToolShapeKind;
  width: number;
  height: number;
  source: { x: number; y: number; angle: number };
}

export const ASSEMBLY_SHAPE_HEIGHTS = { page: 35, editor: 35, command: 13, skill: 23, hook: 35, automation: 34 };

export const LOOSE_PIECES: AssemblyPiece[] = SETTLED_SHAPE_POSITIONS.map((source, index) => {
  const kind = ASSEMBLY_KINDS[index % ASSEMBLY_KINDS.length];
  const height = ASSEMBLY_SHAPE_HEIGHTS[kind] * (0.8 + ((index * 17) % 9) / 20);
  return {
    id: `block-${index}`,
    kind,
    height,
    width: height * TOOL_SHAPE_ASPECT[kind],
    source,
  };
});
