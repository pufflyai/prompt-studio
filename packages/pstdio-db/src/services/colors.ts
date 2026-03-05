export const VALID_COLORS = [
  "gray",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "purple",
  "pink",
  "rose",
] as const;

export type ValidColor = (typeof VALID_COLORS)[number];

export const isValidColor = (color: string): color is ValidColor => VALID_COLORS.includes(color as ValidColor);
