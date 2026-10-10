// Give each plan flag one label and tone so rows, sections, and details agree.

// Colour is kept for signals only: red for work that cannot move, orange for work at risk.
export const toneColor = { danger: "red.fg", warning: "orange.fg" } as const;

const dayLabel = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export const formatDay = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`));

// A deadline whose tickets are all done is never late, however long ago it passed.
export function countdown(daysLeft: number, complete: boolean) {
  if (complete) {
    return "Complete";
  }

  if (daysLeft < 0) {
    return `${-daysLeft} ${-daysLeft === 1 ? "day" : "days"} late`;
  }

  return daysLeft === 0 ? "Due today" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;
}
