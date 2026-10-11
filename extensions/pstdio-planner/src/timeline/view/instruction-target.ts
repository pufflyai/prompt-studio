// Resolve relative instruction links to the Planner ticket that owns the attachment.
import type { PlanRow } from "../contracts";

export function instructionTarget(
  href: string,
  row: Pick<PlanRow, "target">,
  rows: Pick<PlanRow, "shorthand" | "target">[],
) {
  if (/^[a-z]+:|^\/\/|^#/i.test(href)) {
    return;
  }

  const shorthand = href.match(/(?:^|\/)([a-z][a-z0-9]*-\d+)(?:\/|$)/i)?.[1]?.toLowerCase();
  return shorthand ? rows.find((entry) => entry.shorthand.toLowerCase() === shorthand)?.target : row.target;
}
