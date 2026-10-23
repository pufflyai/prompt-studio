import { createExampleStore } from "../example-store";
import { exampleDefaults } from "../state-defaults";
import { kilnFrameRate, sampleKilnPlayback } from "./kiln-animation";
import type { KilnVector } from "./kiln-data";

const stateStore = createExampleStore("kiln", exampleDefaults.kiln);
let snapshot = stateStore.getState();
const listeners = new Set<() => void>();
const update = () => {
  const state = stateStore.getState();
  snapshot = { ...state, frame: sampleKilnPlayback(state, Date.now()) };
  for (const listener of listeners) listener();
};
stateStore.subscribe(update);
export const kilnStore = {
  ...stateStore,
  getState: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  connect(...args: Parameters<typeof stateStore.connect>) {
    const disconnect = stateStore.connect(...args);
    const timer = window.setInterval(() => {
      if (stateStore.getState().playing) update();
    }, 1000 / kilnFrameRate);
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
