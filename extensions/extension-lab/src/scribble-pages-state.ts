import type { ScribbleDocument } from "./apps/scribble-data";
import { documentMarkdown, type exampleDefaults } from "./state-defaults";

type ScribbleState = typeof exampleDefaults.scribble;

export const filterScribbleDocuments = (state: ScribbleState, filter = "") => {
  const words = filter.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return state.documents.filter((document) => {
    const content = state.contentById[document.id] ?? documentMarkdown(document);
    const text = `${document.title} ${content}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
};

export const moveScribbleDocument = (
  documents: readonly ScribbleDocument[],
  sourceId: string,
  targetId?: string,
  position = "after",
) => {
  if (sourceId === targetId) return [...documents];
  const source = documents.find((document) => document.id === sourceId);
  if (!source) throw new Error("Page not found");
  const remaining = documents.filter((document) => document.id !== sourceId);
  if (!targetId) return [...remaining, source];
  const index = remaining.findIndex((document) => document.id === targetId);
  if (index < 0) throw new Error("Destination page not found");
  const next = [...remaining];
  next.splice(index + Number(position === "after"), 0, source);
  return next;
};

export const createScribbleDocument = (state: ScribbleState, id: string) => {
  const document: ScribbleDocument = {
    id,
    title: "Untitled page",
    icon: "FileText",
    eyebrow: "",
    intro: "",
    sections: [],
    tasks: [],
  };
  return { ...state, documents: [...state.documents, document], contentById: { ...state.contentById, [id]: "" } };
};
