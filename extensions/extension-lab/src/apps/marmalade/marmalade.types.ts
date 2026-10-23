export type MarmaladeTool = "move" | "text" | "hand" | "zoom";
export interface MarmaladeLayer {
  id: string;
  name: string;
  kind: "image" | "text" | "shape" | "group";
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
}
export interface MarmaladeState {
  document: { id: string; title: string; width: number; height: number; layers: MarmaladeLayer[] };
  selectedIds: string[];
  expandedIds: string[];
  tool: MarmaladeTool;
  zoom: number;
  pan: { x: number; y: number };
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
  | { type: "reset" }
  | { type: "empty" };
