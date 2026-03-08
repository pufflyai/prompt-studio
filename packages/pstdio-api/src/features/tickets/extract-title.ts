export const extractTitleFromContent = (content: string) => {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) return trimmed.slice(2).trim();
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }

  return "Untitled";
};
