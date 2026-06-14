export { normalizeTicketDependencies, type TicketDependencyValue } from "../data/ticket-dependencies";

export const formatTicketUpdatedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};
