// Explain the displayed blocker without storing a second copy of Planner's reason or prerequisites.
import type { PlanRow } from "../contracts";

export function blockReason(row: Pick<PlanRow, "blockedReason" | "dependsOn" | "state">) {
  if (row.state === "done" || row.dependsOn.some(({ done }) => !done)) {
    return undefined;
  }

  const saved = row.blockedReason?.trim();
  if (saved) {
    return saved;
  }

  if (row.state !== "blocked") {
    return undefined;
  }

  return "No block reason provided.";
}
