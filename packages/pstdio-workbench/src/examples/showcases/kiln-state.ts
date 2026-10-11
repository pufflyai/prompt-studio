import type { WorkbenchCore } from "../../core";
import { type KilnVector, kilnObjects } from "./kiln-data";
import { createShowcaseStore } from "./showcase-store";

export interface KilnObjectState {
  position: KilnVector;
  rotation: KilnVector;
  scale: KilnVector;
  visible: boolean;
}

interface KilnState {
  frame: number;
  objectStates: Record<string, KilnObjectState>;
  playing: boolean;
}

const createKilnStore = () =>
  createShowcaseStore<KilnState>({
    frame: 42,
    objectStates: Object.fromEntries(
      kilnObjects.map((object) => [
        object.id,
        {
          position: structuredClone(object.position),
          rotation: structuredClone(object.rotation),
          scale: structuredClone(object.scale),
          visible: true,
        },
      ]),
    ),
    playing: false,
  });

const stores = new WeakMap<WorkbenchCore, ReturnType<typeof createKilnStore>>();
export const getKilnStore = (workbench: WorkbenchCore) => {
  let store = stores.get(workbench);
  if (!store) {
    store = createKilnStore();
    stores.set(workbench, store);
  }
  return store;
};

export const updateKilnVector = (
  workbench: WorkbenchCore,
  objectId: string,
  property: "position" | "rotation" | "scale",
  axis: number,
  value: number,
) => {
  getKilnStore(workbench).setState((state) => {
    const objectState = state.objectStates[objectId];
    if (!objectState) return state;
    const vector = [...objectState[property]] as KilnVector;
    vector[axis] = value;
    return {
      ...state,
      objectStates: {
        ...state.objectStates,
        [objectId]: { ...objectState, [property]: vector },
      },
    };
  });
};

export const toggleKilnVisibility = (workbench: WorkbenchCore, objectId: string) => {
  getKilnStore(workbench).setState((state) => {
    const objectState = state.objectStates[objectId];
    if (!objectState) return state;
    return {
      ...state,
      objectStates: {
        ...state.objectStates,
        [objectId]: { ...objectState, visible: !objectState.visible },
      },
    };
  });
};
