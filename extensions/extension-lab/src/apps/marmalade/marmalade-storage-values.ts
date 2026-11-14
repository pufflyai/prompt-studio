import { diffEditingState, type JsonObject, type StorageSaveOutcome } from "@pstdio/sdk/extensions";
import type { MarmaladeState } from "./marmalade.types";
import {
  type MarmaladeLayerIndex,
  type MarmaladePresentation,
  marmaladeLayerIndex,
  marmaladePresentation,
  reconcileMarmaladePresentation,
} from "./marmalade-presentation";

export const marmaladeKeys = {
  document: "marmalade:document:great-wave",
  history: "marmalade:history",
  presentation: "marmalade:presentation",
};
export interface MarmaladeDocumentRecord {
  version: 2;
  document: MarmaladeState["document"];
}
export interface MarmaladePresentationRecord {
  version: 1;
  documentId: string;
  values: MarmaladePresentation;
  layers: MarmaladeLayerIndex;
}
export const marmaladeJson = (value: object) => JSON.parse(JSON.stringify(value)) as JsonObject;
export const assertMarmaladeSaved = (outcome: StorageSaveOutcome) => {
  if (outcome.state === "needs-attention" || outcome.state === "refused")
    throw new Error(outcome.reason ?? "The document could not be saved");
};
export const marmaladePresentationRecord = (state: MarmaladeState) => {
  const layers = marmaladeLayerIndex(state.document);
  return {
    version: 1,
    documentId: state.document.id,
    values: reconcileMarmaladePresentation(marmaladePresentation(state), layers),
    layers,
  } satisfies MarmaladePresentationRecord;
};
export const marmaladePresentationEdits = (before: MarmaladePresentation, after: MarmaladePresentation) =>
  Object.fromEntries(diffEditingState(before, after).map(({ path, value }) => [`/values/${path.join("/")}`, value]));
export const marmaladePointer = (path: string[]) =>
  path.map((key) => `/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");
export const marmaladeDocumentEdits = (before: MarmaladeState["document"], after: MarmaladeState["document"]) => {
  const changes = diffEditingState({ document: before }, { document: after });
  return Object.fromEntries(changes.map(({ path, value }) => [marmaladePointer(path), value]));
};
