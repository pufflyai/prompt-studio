import { formatRelative } from "date-fns";
import type { Session } from "../types";

export interface SessionGroup {
  label: string;
  sessions: Session[];
}

export const getDateLabel = (date: Date) => {
  const now = new Date();
  const relative = formatRelative(date, now);
  const firstWord = relative.split(" ")[0];

  if (["today", "yesterday"].includes(firstWord)) {
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

export const groupSessionsByDate = (sessions: Session[]): SessionGroup[] => {
  if (sessions.length === 0) return [];

  const sorted = [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const groups: SessionGroup[] = [];

  for (const session of sorted) {
    const label = getDateLabel(new Date(session.updatedAt));
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.label === label) {
      lastGroup.sessions.push(session);
    } else {
      groups.push({ label, sessions: [session] });
    }
  }

  return groups;
};
