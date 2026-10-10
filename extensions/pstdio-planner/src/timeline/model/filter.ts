import type { PlanSection } from "../contracts";

// An empty deadline has nothing finished, so it is never complete.
export const isComplete = (section: PlanSection) =>
  section.counts.total > 0 && section.counts.done === section.counts.total;
