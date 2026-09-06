import { createExampleStore } from "../example-store";
import { exampleDefaults } from "../state-defaults";
import type { KilnVector } from "./kiln-data";

export interface KilnObjectState {
  position: KilnVector;
  rotation: KilnVector;
  scale: KilnVector;
  visible: boolean;
}

const stateStore = createExampleStore("kiln", exampleDefaults.kiln);
export const kilnStore = {
  ...stateStore,
  connect(...args: Parameters<typeof stateStore.connect>) {
    const disconnect = stateStore.connect(...args);
    let startedAt = 0;
    let firstFrame = 1;
    const timer = window.setInterval(() => {
      const state = stateStore.getState();
      if (!state.playing) {
        startedAt = 0;
        return;
      }
      if (startedAt !== state.playbackStartedAt) {
        startedAt = state.playbackStartedAt;
        firstFrame = state.frame;
      }
      const elapsed = Math.floor(((Date.now() - startedAt) * 24) / 1000);
      stateStore.setTransient({ frame: ((firstFrame - 1 + elapsed) % 120) + 1 });
    }, 1000 / 24);
    return () => {
      window.clearInterval(timer);
      disconnect();
    };
  },
};

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
