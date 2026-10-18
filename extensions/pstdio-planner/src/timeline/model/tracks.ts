// Build feature branches from the dedicated single-select Track property.
import type { PlanRow, PlanTag } from "../contracts";

export interface Track {
  id: string;
  label: string;
}

export function trackProperty<T extends PlanTag>(tags: T[]) {
  const matches = tags.filter(({ name }) => name.toLowerCase() === "track");
  if (matches.length > 1) {
    throw new Error(
      "Several properties are named Track. In Settings > Project Planner > Ticket tags, rename or delete the extra ones so one Track property remains.",
    );
  }
  const property = matches[0];
  if (property && property.type !== "single_select") {
    throw new Error(
      "Track must be a single-select property. In Settings > Project Planner > Ticket tags, set Track to Single. Tickets with more than one Track value must keep one value first.",
    );
  }
  return property;
}

export const unassignedTrack: Track = { id: "unassigned", label: "Unassigned" };

export const trackOptions = (property: PlanTag) => property.options.map(({ id, name }) => ({ id, label: name }));

// Rows take their column from the given list, so every graph part agrees on track positions.
export function trackLayout(list: Track[]) {
  const indexOf = (row: Pick<PlanRow, "trackId">) =>
    Math.max(
      0,
      list.findIndex(({ id }) => id === (row.trackId ?? unassignedTrack.id)),
    );
  return { list, indexOf };
}

export function buildTracks(property: PlanTag | undefined, rows: PlanRow[]) {
  const list = property ? trackOptions(property) : [];
  if (!list.length || rows.some(({ trackId }) => !list.some(({ id }) => id === trackId))) {
    list.push(unassignedTrack);
  }
  return trackLayout(list);
}
