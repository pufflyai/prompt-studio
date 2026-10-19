import type { PlanPace, PlanRow, PlanSection, PlanTag } from "../contracts";
import { milestoneEta } from "./milestone-eta";

const atRisk = (row: PlanRow) =>
  !row.done &&
  row.flags.some(
    (flag) => flag === "human-needed" || flag === "blocked" || flag === "waiting" || flag === "out-of-order",
  );

export function summarizeSection(
  section: Pick<PlanSection, "deadline" | "rows">,
  tags: PlanTag[],
  pace: PlanPace | null,
) {
  const { deadline, rows } = section;
  return {
    ...section,
    counts: {
      total: rows.length,
      done: rows.filter((row) => row.done).length,
      humanNeeded: rows.filter((row) => row.flags.includes("human-needed")).length,
      blocked: rows.filter((row) => row.flags.includes("blocked")).length,
      // Risk is measured against a deadline, so unscheduled work has none.
      atRisk: deadline ? rows.filter(atRisk).length : 0,
    },
    eta: deadline ? milestoneEta(rows, tags, pace) : null,
  };
}
