import type { ToolExampleId } from "../../content/tool-examples-content";
import type { AssemblyAgentsSnapshot } from "./assembly-agents";
import type { PhysicsSnapshot } from "./shape-physics";

export interface SimulationSnapshot {
  example: ToolExampleId;
  elapsed: number;
  completedAt?: number;
  clearing: boolean;
  claimed: [string, number][];
  physics: PhysicsSnapshot;
  agents: AssemblyAgentsSnapshot;
}

// Preserve the playground across client navigation. Reloading starts a new scene.
let savedSimulation: SimulationSnapshot | null = null;
export const readSimulation = () => savedSimulation;
export const saveSimulation = (snapshot: SimulationSnapshot) => {
  savedSimulation = snapshot;
};
