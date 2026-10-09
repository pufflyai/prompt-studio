// Describe where a dragged ticket would land: before a ticket in a deadline, or at the deadline's end.
export interface DropTarget {
  deadlineId: string | null;
  beforeId?: string;
  trackId?: string | null;
}

export const sameTarget = (left: DropTarget | undefined, right: DropTarget) =>
  left?.deadlineId === right.deadlineId && left?.beforeId === right.beforeId && left?.trackId === right.trackId;
