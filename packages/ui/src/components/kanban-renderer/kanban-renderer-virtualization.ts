/** Lists at or above this size mount only the entries near the viewport. */
export const KANBAN_VIRTUALIZATION_THRESHOLD = 50;

/** Small boards and lists render every entry; large ones use a virtual window. */
export const shouldVirtualizeKanban = (entryCount: number) => entryCount >= KANBAN_VIRTUALIZATION_THRESHOLD;
