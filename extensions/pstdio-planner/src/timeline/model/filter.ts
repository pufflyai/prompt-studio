import type { Plan, PlanSection } from "../contracts";
import { type MilestoneDisplay, milestoneVisible } from "./milestone-visibility";
import { summarizeSection } from "./section-summary";

export function filterSections(plan: Plan, visibleTicketIds: ReadonlySet<string>, display: MilestoneDisplay = {}) {
  return plan.sections
    .filter((section) => milestoneVisible(section, display))
    .flatMap((section) => {
      const rows = section.rows.filter((row) => visibleTicketIds.has(row.id));
      if (section.rows.length > 0 && rows.length === 0) return [];
      return [summarizeSection({ ...section, rows }, plan.tags, plan.pace)];
    });
}

// An empty deadline has nothing finished, so it is never complete.
export const isComplete = (section: PlanSection) =>
  section.counts.total > 0 && section.counts.done === section.counts.total;
