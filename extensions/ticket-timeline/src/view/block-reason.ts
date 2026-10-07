// Explain the displayed blocker without storing a second copy of Planner's reason or prerequisites.
import type { PlanRow } from "../contracts";

export function blockReason(row: Pick<PlanRow, "blockedReason" | "dependsOn" | "state">) {
  if (row.state === "done") {
    return undefined;
  }

  const saved = row.blockedReason?.trim();
  if (saved) {
    return saved;
  }

  if (row.state !== "blocked") {
    return undefined;
  }

  const prerequisites = row.dependsOn.filter(({ done }) => !done).map(({ shorthand }) => shorthand);
  return prerequisites.length ? `Waiting for ${prerequisites.join(", ")}.` : "No block reason provided.";
}
