import type { ResourceActivityEntry } from "@pstdio/sdk/extensions";

const valueText = (value: unknown) => {
  if (value === null || value === undefined) return "None";
  return typeof value === "string" ? value : JSON.stringify(value);
};
export const activityChangeSummary = (entry: Pick<ResourceActivityEntry, "body" | "changes">) =>
  entry.changes?.length
    ? entry.changes
        .map((change) => {
          if (change.field === "archived") return change.after ? "archived this resource" : "unarchived this resource";
          return `changed ${(change.label ?? change.field).toLocaleLowerCase()} to ${change.afterLabel ?? valueText(change.after)}`;
        })
        .join("; ")
    : entry.body;

export const activityActorName = (entry: ResourceActivityEntry) => {
  if (entry.author.type !== "system" || entry.author.name !== entry.author.extensionId) return entry.author.name;
  const name =
    entry.author.name
      .split(".")
      .at(-1)
      ?.replace(/^pstdio-/, "") ?? "System";
  return name.charAt(0).toUpperCase() + name.slice(1).replaceAll("-", " ");
};
export const activityTime = (createdAt: string, now = Date.now()) => {
  const seconds = Math.max(0, (now - Date.parse(createdAt)) / 1000);
  if (seconds < 60) return "just now";
  for (const [unit, divisor] of [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ] as const) {
    if (seconds >= divisor)
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" }).format(
        -Math.floor(seconds / divisor),
        unit,
      );
  }
  return "just now";
};
