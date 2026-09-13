import Matter from "matter-js";
import type { FieldSize } from "./field-layout";
import { createPiece, type Piece } from "./shape-physics";

export const snapshotPiece = (piece: Piece) => ({
  id: piece.id,
  kind: piece.kind,
  width: piece.width,
  height: piece.height,
  position: { ...piece.body.position },
  angle: piece.body.angle,
  velocity: Matter.Body.getVelocity(piece.body),
  angularVelocity: Matter.Body.getAngularVelocity(piece.body),
});

export interface SimulationSnapshot {
  size: FieldSize;
  spawnRemaining: number;
  pieces: ReturnType<typeof snapshotPiece>[];
}

export const restorePiece = (saved: ReturnType<typeof snapshotPiece>) => {
  const piece = createPiece({ ...saved, x: 0, y: 0 });
  Matter.Body.setPosition(piece.body, saved.position);
  Matter.Body.setVelocity(piece.body, saved.velocity);
  Matter.Body.setAngularVelocity(piece.body, saved.angularVelocity);
  return piece;
};

// Keep the scene across client navigation; a new document starts a fresh scene.
let savedSimulation: SimulationSnapshot | null = null;

export const readSimulation = () => savedSimulation;

export const saveSimulation = (snapshot: SimulationSnapshot) => {
  savedSimulation = snapshot;
};
