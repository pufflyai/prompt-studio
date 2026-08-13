import { create } from "zustand";

interface LabState {
  counter: number;
  setCounter: (value: number) => void;
}

export const useLabStore = create<LabState>((set) => ({
  counter: 0,
  setCounter: (value) => set({ counter: value }),
}));
