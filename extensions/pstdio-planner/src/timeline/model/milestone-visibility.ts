import type { PlanSection } from "../contracts";

export interface MilestoneDisplay {
  showPassedMilestones?: boolean;
  showCompletedMilestones?: boolean;
}

export function milestoneVisible(section: PlanSection, display: MilestoneDisplay) {
  if (!section.deadline) return true;
  if (display.showPassedMilestones === false && section.deadline.daysLeft < 0) return false;
  return (
    display.showCompletedMilestones !== false ||
    section.counts.total === 0 ||
    section.counts.done !== section.counts.total
  );
}
