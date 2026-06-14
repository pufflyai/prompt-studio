export type TicketDependencyValue = string | string[] | null | undefined;

export const normalizeTicketDependencies = (value: TicketDependencyValue) => {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((id) => id.trim()).filter((id) => id.length > 0 && id !== "[]");
};
