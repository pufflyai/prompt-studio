import { create } from "zustand";

export interface LabNote {
  id: string;
  text: string;
  createdAt: number;
}

interface LabState {
  counter: number;
  notes: LabNote[];
  draft: string;
  setDraft: (value: string) => void;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  addNote: (text: string) => void;
  removeNote: (id: string) => void;
  clearNotes: () => void;
}

const newNoteId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useLabStore = create<LabState>((set) => ({
  counter: 0,
  notes: [],
  draft: "",
  setDraft: (value) => set({ draft: value }),
  increment: () => set((state) => ({ counter: state.counter + 1 })),
  decrement: () => set((state) => ({ counter: state.counter - 1 })),
  reset: () => set({ counter: 0 }),
  addNote: (text) =>
    set((state) => {
      const trimmed = text.trim();
      if (!trimmed) return state;
      const note: LabNote = { id: newNoteId(), text: trimmed, createdAt: Date.now() };
      return { notes: [note, ...state.notes], draft: "" };
    }),
  removeNote: (id) => set((state) => ({ notes: state.notes.filter((note) => note.id !== id) })),
  clearNotes: () => set({ notes: [] }),
}));
