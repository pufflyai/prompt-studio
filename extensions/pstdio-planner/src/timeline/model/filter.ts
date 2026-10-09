// Choose which timeline rows and deadlines the display settings show.
import type { DisplaySettings, PlanRow, PlanSection } from "../contracts";

// Attention covers open work with a deadline or blocker problem and open work that holds others up.
const needsAttention = (row: PlanRow) => !row.done && (row.flags.length > 0 || row.blocks.length > 0);

export function filterRows(rows: PlanRow[], display: DisplaySettings) {
  if (display.attentionOnly) {
    return rows.filter(needsAttention);
  }

  return display.showDone ? rows : rows.filter((row) => !row.done);
}

// An empty deadline has nothing finished, so it is never complete.
export const isComplete = (section: PlanSection) =>
  section.counts.total > 0 && section.counts.done === section.counts.total;

const completedPast = (section: PlanSection) =>
  section.deadline !== null && section.deadline.daysLeft < 0 && isComplete(section);

export const visibleSections = (sections: PlanSection[], display: DisplaySettings) =>
  display.showCompletedPastDeadlines ? sections : sections.filter((section) => !completedPast(section));
