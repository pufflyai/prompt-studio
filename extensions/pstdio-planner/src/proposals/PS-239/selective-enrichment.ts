import { buildPlan, type PlanInput } from "../../timeline/model/build-plan";
import { timelineTicketProperties } from "../../timeline/model/ticket-properties";

const timelineFields = new Set(["milestone", "milestoneDate", "milestoneState", "needsAttention", "reviewRequests"]);
interface FieldUse {
  display: string[];
  filter: string[];
  sort: string[];
  group: string[];
  action: string[];
}

// This is an explicit field-use prototype, not an adapter for every ViewFilterGroup.
// Production integration must collect these dependencies from the actual query.
export const selectiveTimelineEnrichment = (input: PlanInput, use: FieldUse) => {
  const required = Object.values(use)
    .flat()
    .some((field) => timelineFields.has(field));
  if (!required) return undefined;
  return timelineTicketProperties(buildPlan(input));
};
