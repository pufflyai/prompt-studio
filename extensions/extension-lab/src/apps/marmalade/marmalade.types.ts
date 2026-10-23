export type MarmaladeTool = "move" | "text" | "rectangle" | "ellipse" | "brush" | "hand" | "zoom";
export interface MarmaladeAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
}
export interface MarmaladeProperties {
  name: string;
  width: number;
  height: number;
  rotation: number;
  color: string;
  fontSize: number;
  fontFamily: "sans-serif" | "serif" | "monospace";
  fontWeight: "400" | "700";
  align: "left" | "center" | "right";
  strokeWidth: number;
}
export interface MarmaladeLayer {
  id: string;
  name: string;
  kind: "image" | "text" | "shape" | "group" | "brush";
  parentId?: string;
  visible: boolean;
  locked: boolean;
  disabled?: boolean;
  mask?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  text?: string;
  shape?: "rectangle" | "ellipse";
  rotation?: number;
  color?: string;
  fontSize?: number;
  fontFamily?: MarmaladeProperties["fontFamily"];
  fontWeight?: MarmaladeProperties["fontWeight"];
  align?: MarmaladeProperties["align"];
  strokeWidth?: number;
  points?: [number, number][];
  adjustments?: MarmaladeAdjustments;
}
export interface MarmaladeState {
  document: { id: string; title: string; width: number; height: number; layers: MarmaladeLayer[] };
  selectedIds: string[];
  expandedIds: string[];
  tool: MarmaladeTool;
  zoom: number;
  pan: { x: number; y: number };
}
export interface MarmaladeViewState extends MarmaladeState {
  history: { undo: number; redo: number };
}
export type MarmaladeAction =
  | { type: "select"; ids: string[] }
  | { type: "expand"; id: string }
  | { type: "tool"; tool: MarmaladeTool }
  | { type: "viewport"; zoom?: number; pan?: { x: number; y: number } }
  | { type: "visibility"; id: string; visible: boolean }
  | { type: "lock"; id: string; locked: boolean }
  | { type: "opacity"; id: string; opacity: number }
  | { type: "text"; id: string; text: string }
  | { type: "transform"; ids: string[]; dx: number; dy: number }
  | { type: "position"; id: string; x?: number; y?: number }
  | { type: "reorder"; source: string; target?: string; position: "before" | "after" | "inside" }
  | {
      type: "create";
      kind: "text" | "rectangle" | "ellipse" | "brush";
      x: number;
      y: number;
      width?: number;
      height?: number;
      points?: [number, number][];
      color?: string;
      strokeWidth?: number;
    }
  | { type: "properties"; id: string; changes: Partial<MarmaladeProperties> }
  | { type: "adjustments"; id: string; changes: Partial<MarmaladeAdjustments> }
  | { type: "duplicate" | "delete" | "group" | "ungroup" | "undo" | "redo" }
  | { type: "reset" }
  | { type: "empty" };
