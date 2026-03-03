export const deriveShorthand = (name: string) =>
  name
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join("");
