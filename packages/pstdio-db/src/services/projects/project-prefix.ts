export const isProjectPrefix = (value: string) => /^[A-Z][A-Z0-9]{0,15}$/.test(value) && value !== "WS";

export const projectPrefixCandidate = (base: string, number: number) => {
  const suffix = number === 1 ? "" : String(number);
  return `${base.slice(0, 16 - suffix.length)}${suffix}`;
};
