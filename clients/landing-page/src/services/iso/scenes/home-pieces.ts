import { puff } from "../agents";
import { ISO_SURFACE, kindColor, type ToolKind, tool } from "../greek";
import type { IsoBox, IsoScene } from "../scene";

// block: made, on its way to its slot · seated: on its slot, waiting to be patted · tool: finished
// held: in the visitor's hand · dropped: let go off the workbench, waiting for an agent to fetch it
export type State = "block" | "seated" | "tool" | "held" | "dropped";
export type Piece = IsoBox & { kind: ToolKind; state: State; slot: number; claimed: boolean; stage: number };
export interface Slot {
  x: number;
  y: number;
  w: number;
  d: number;
  piece: Piece | null;
  reserved: boolean;
}

export const BLOCK = { w: 26, d: 26, h: 22 };

/** How a Home piece changes shape: block → slab → working tool, one stage per pat. */
export const shapePieces = (scene: IsoScene, slots: Slot[]) => {
  const center = (piece: Piece, w: number, d: number) => {
    const slot = slots[piece.slot];
    Object.assign(piece.t, { x: slot.x + slot.w / 2 - w / 2, y: slot.y + slot.d / 2 - d / 2, w, d });
  };
  const seat = (piece: Piece) => {
    piece.state = "seated";
    center(piece, BLOCK.w, BLOCK.d);
    piece.t.z = 10;
  };
  const toBlock = (piece: Piece) => {
    piece.color = kindColor(piece.kind);
    scene.paint(piece);
    piece.top.innerHTML = "";
    Object.assign(piece.t, BLOCK);
    piece.stage = 0;
  };
  // Two pats: the block flattens into a slab, then becomes a working tool.
  const stages = [
    (piece: Piece) => {
      center(piece, 52, 46);
      piece.t.h = 9;
    },
    (piece: Piece) => {
      center(piece, 66, 60);
      piece.t.h = 3;
      piece.color = ISO_SURFACE;
      scene.paint(piece);
      piece.top.innerHTML = tool(piece.kind);
      piece.state = "tool";
    },
  ];
  const advance = (piece: Piece) => {
    if (piece.state === "seated" && piece.stage < stages.length) stages[piece.stage++](piece);
  };
  // The visitor can pat a piece too, the same way the agents do.
  const patByHand = (piece: Piece) => {
    if (piece.state !== "seated") return;
    advance(piece);
    piece.h = Math.max(1, piece.h * 0.55);
    puff(scene, piece.t.x + piece.t.w / 2, piece.t.y + piece.t.d / 2, piece.t.z + piece.t.h);
  };
  return { seat, toBlock, advance, patByHand, stageCount: stages.length };
};
