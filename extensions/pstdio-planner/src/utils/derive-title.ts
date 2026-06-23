const stripTitleMarkup = (line: string) =>
  line
    .replace(/^\s{0,3}#{1,6}(?=\s|$)\s*/, "")
    .replace(/^\s*(?:>\s*)?(?:[-*+]\s+|\d+\.\s+)*/, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|\s)([*_])([^*_]+)\2(?=$|\s|[.,!?:;)])/g, "$1$3")
    .replace(/~~(.*?)~~/g, "$1")
    .trim();

// The board card and breadcrumb show the ticket title, but tickets have no
// separate title field in the editor, so the title is the first visible
// markdown text from the body.
export const deriveTitle = (content: string) => {
  let inCodeFence = false;

  for (const line of content.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    const title = stripTitleMarkup(line);
    if (title.length > 0) return title;
  }

  return "Untitled";
};
