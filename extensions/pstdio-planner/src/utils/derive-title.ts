// The board card and breadcrumb show the ticket title, but tickets have no
// separate title field in the editor — the title is the start of the body,
// mirroring the old dashboard's content-as-title flow.
export const deriveTitle = (content: string) => {
  const firstLine = content
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find((line) => line.length > 0);
  return firstLine || "Untitled";
};
