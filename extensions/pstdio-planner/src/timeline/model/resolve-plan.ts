import type { Deadline } from "../contracts";

export const byDate = (left: Deadline, right: Deadline) =>
  left.date.localeCompare(right.date) || (left.name ?? "").localeCompare(right.name ?? "");
