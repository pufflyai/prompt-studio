// Build feature branches from the dedicated single-select Track property.
import type { PlanRow, PlanTag } from "../contracts";

export interface Track {
  id: string;
  label: string;
}

export function trackProperty<T extends PlanTag>(tags: T[]) {
  const matches = tags.filter(({ name }) => name.toLowerCase() === "track");
  if (matches.length > 1) {
    throw new Error("Several Track properties exist. Keep one dedicated Track property.");
  }
  const property = matches[0];
  if (property && property.type !== "single_select") {
    throw new Error("Track must be a single-select property.");
  }
  return property;
}

export function buildTracks(property: PlanTag | undefined, rows: PlanRow[]) {
  const list: Track[] = property?.options.map(({ id, name }) => ({ id, label: name })) ?? [];
  const unassigned = { id: "unassigned", label: "Unassigned" };
  if (!list.length || rows.some(({ trackId }) => !list.some(({ id }) => id === trackId))) {
    list.push(unassigned);
  }
  const indexOf = (row: PlanRow) =>
    Math.max(
      0,
      list.findIndex(({ id }) => id === (row.trackId ?? "unassigned")),
    );
  return { list, indexOf };
}
