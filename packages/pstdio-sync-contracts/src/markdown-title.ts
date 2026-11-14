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

/** First visible Markdown text, ignoring fenced code and image-only lines. */
export const deriveMarkdownTitle = (content: string, empty = "") => {
  let fence: { marker: string; length: number } | undefined;
  for (const line of content.split("\n")) {
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (delimiter && delimiter[1][0] === fence.marker && delimiter[1].length >= fence.length && !delimiter[2].trim())
        fence = undefined;
      continue;
    }
    if (delimiter && !(delimiter[1][0] === "`" && delimiter[2].includes("`"))) {
      fence = { marker: delimiter[1][0], length: delimiter[1].length };
      continue;
    }
    const title = stripTitleMarkup(line);
    if (title.length) return title;
  }
  return empty;
};
