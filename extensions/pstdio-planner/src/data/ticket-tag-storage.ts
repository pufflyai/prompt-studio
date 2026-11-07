import { tagValueIds } from "./ticket-tags";
import type { StoredTicket, StoredTicketTags } from "./types";

type TagSelection = (
  | { type: "single"; value: string | null }
  | { type: "multi"; value?: string | null; replacedValue?: string | null }
) & {
  options?: Record<string, boolean>;
};

export interface StoredTicketRecord extends StoredTicket {
  tagSelections?: Record<string, TagSelection>;
}

// Existing arrays are retained as read-only migration input. Each new multi-select
// choice has its own JSON path, including false for an explicitly removed option.
export const readTicketTags = (stored: StoredTicketRecord) => {
  const { tagSelections, ...ticket } = stored;
  if (!tagSelections) return ticket;
  const tags: StoredTicketTags = { ...stored.tags };
  for (const [tagId, selection] of Object.entries(tagSelections)) {
    const options = selection.options ?? {};
    const previous =
      selection.type === "single" ? tagValueIds(selection.value ?? undefined) : tagValueIds(stored.tags?.[tagId]);
    const selected = [...new Set([...previous, ...Object.keys(options)])].filter(
      (id) => options[id] ?? previous.includes(id),
    );
    if (
      selection.type === "multi" &&
      selection.value != null &&
      selection.value !== selection.replacedValue &&
      !selected.includes(selection.value)
    )
      selected.push(selection.value);
    // A later offline option write can follow a concurrent scalar conversion. Expose
    // that list so the user can resolve it, as with existing tag-definition changes.
    if (selection.type === "single" && selected.length < 2) {
      if (selected[0] === undefined) delete tags[tagId];
      else tags[tagId] = selected[0];
    } else tags[tagId] = selected;
  }
  return { ...ticket, tags };
};

const multiSelection = (current: TagSelection | undefined, legacy: string[], before: string[], value: string[]) => {
  const options = current?.type === "multi" ? { ...current.options } : {};
  // Keep the scalar channel, recording exactly which choice this conversion consumed.
  // A concurrent scalar change then remains visible until a later edit resolves it.
  if (current?.value !== undefined) {
    for (const id of new Set([...legacy, ...before]))
      if (legacy.includes(id) !== before.includes(id)) options[id] = before.includes(id);
  }
  for (const id of new Set([...before, ...value]))
    if (before.includes(id) !== value.includes(id)) options[id] = value.includes(id);
  return {
    type: "multi" as const,
    ...(current?.value === undefined ? {} : { value: current.value, replacedValue: current.value }),
    ...(Object.keys(options).length ? { options } : {}),
  };
};

export const writeTicketTags = (next: StoredTicket, stored?: StoredTicketRecord) => {
  if (!stored) return next;
  const previous = readTicketTags(stored).tags ?? {};
  const tags = next.tags ?? {};
  const selections = { ...stored.tagSelections };
  for (const tagId of new Set([...Object.keys(previous), ...Object.keys(tags)])) {
    const value = tags[tagId];
    if (JSON.stringify(previous[tagId]) === JSON.stringify(value)) continue;
    if (!Array.isArray(value)) {
      selections[tagId] = { type: "single", value: value ?? null };
      continue;
    }
    selections[tagId] = multiSelection(
      selections[tagId],
      tagValueIds(stored.tags?.[tagId]),
      tagValueIds(previous[tagId]),
      value,
    );
  }
  if (Object.keys(selections).length === 0) return next;
  return { ...next, tags: stored.tags, tagSelections: selections };
};
