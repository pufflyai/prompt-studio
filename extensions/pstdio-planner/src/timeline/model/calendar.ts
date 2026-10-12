// Turn a hovered point on the milestone timeline into the date a new milestone would get.
import { addDays, daysBetween } from "./days";

export interface TimelineAnchor {
  // Vertical position of a dated milestone's marker on the line.
  y: number;
  date: string;
}

// Past either end of the line, about one milestone header of distance adds one day.
const dayHeight = 40;

// Anchors must be sorted by position. Between two milestones the date follows the position in
// proportion and stays strictly between them when a day is free.
export function ghostDate(anchors: TimelineAnchor[], y: number, today: string) {
  if (anchors.length === 0) {
    return today;
  }

  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (y <= first.y) {
    return addDays(first.date, -Math.max(1, Math.round((first.y - y) / dayHeight)));
  }

  if (y >= last.y) {
    return addDays(last.date, Math.max(1, Math.round((y - last.y) / dayHeight)));
  }

  const after = anchors.findIndex((anchor) => anchor.y > y);
  const from = anchors[after - 1];
  const to = anchors[after];
  const days = daysBetween(from.date, to.date);
  if (days < 2) {
    return to.date;
  }

  const offset = Math.round(((y - from.y) / (to.y - from.y)) * days);
  return addDays(from.date, Math.min(days - 1, Math.max(1, offset)));
}
