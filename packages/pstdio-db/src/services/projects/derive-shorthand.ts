export const deriveShorthand = (name: string) =>
  name
    .replace(/[^a-zA-Z\s\-_]/g, "")
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join("");
