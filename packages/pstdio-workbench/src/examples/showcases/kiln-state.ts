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

export const kilnStore = createShowcaseStore<KilnState>({
  frame: 42,
  objectStates: Object.fromEntries(
    kilnObjects.map((object) => [
      object.id,
      {
        position: object.position,
        rotation: object.rotation,
        scale: object.scale,
        visible: true,
      },
    ]),
  ),
  playing: false,
});

export const updateKilnVector = (
  objectId: string,
  property: "position" | "rotation" | "scale",
  axis: number,
  value: number,
) => {
  kilnStore.setState((state) => {
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

export const toggleKilnVisibility = (objectId: string) => {
  kilnStore.setState((state) => {
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
