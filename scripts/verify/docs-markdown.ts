/**
 * Small Markdown readers for the documentation checks. They cover the syntax this repository uses:
 * ATX headings, inline and reference links, autolinks, bare URLs, and HTML `href`/`src` attributes.
 * Code fences and inline code are skipped, because examples in them are not links.
 */

export interface MarkdownLink {
  url: string;
  line: number;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:[ \t]*<?([^\s>]+)>?/;
const AUTOLINK = /<((?:https?|mailto):[^\s>]+)>/g;
const HTML_ATTRIBUTE = /\b(?:href|src)=["']([^"']+)["']/g;
const HTML_ID = /\b(?:id|name)=["']([^"']+)["']/g;
const BARE_URL = /https?:\/\/[^\s<>"'`\]]+/g;
const INLINE_CODE = /(`+)[\s\S]*?\1/g;
const TABLE_SEPARATOR = /^\s*\|[\s|:-]+\|?\s*$/;

// Windows checkouts may use CRLF line endings.
const splitLines = (text: string) => text.split(/\r?\n/);

/** Lines outside code fences, with their 1-based line numbers. Frontmatter is skipped too. */
const proseLines = (text: string) => {
  const lines = splitLines(text);
  const result: Array<{ text: string; line: number }> = [];
  let fence: string | undefined;
  let start = 0;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) start = end + 1;
  }
  for (let index = start; index < lines.length; index++) {
    const line = lines[index]!;
    const marker = line.match(FENCE)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker)
        fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    result.push({ text: line.replace(INLINE_CODE, (code) => " ".repeat(code.length)), line: index + 1 });
  }
  return result;
};

// Reads the destination after `](`, allowing balanced parentheses inside it.
const readDestination = (line: string, from: number) => {
  let index = from;
  while (line[index] === " ") index++;
  if (line[index] === "<") {
    const end = line.indexOf(">", index);
    return end < 0 ? undefined : { url: line.slice(index + 1, end), end };
  }
  let depth = 0;
  const begin = index;
  for (; index < line.length; index++) {
    const char = line[index]!;
    if (char === "(") depth++;
    else if (char === ")") {
      if (depth === 0) break;
      depth--;
    } else if (char === " " || char === "\t") break;
  }
  return index > begin ? { url: line.slice(begin, index), end: index } : undefined;
};

const trimBareUrl = (url: string) => {
  let result = url.replace(/[.,;:!?*_]+$/, "");
  while (result.endsWith(")") && (result.match(/\(/g)?.length ?? 0) < (result.match(/\)/g)?.length ?? 0)) {
    result = result.slice(0, -1).replace(/[.,;:!?*_]+$/, "");
  }
  return result;
};

/** Every link destination outside code, in document order. */
export const extractLinks = (text: string) => {
  const links: MarkdownLink[] = [];
  for (const { text: line, line: number } of proseLines(text)) {
    const found: Array<{ url: string; at: number }> = [];
    let rest = line;
    const blank = (start: number, end: number) => {
      rest = `${rest.slice(0, start)}${" ".repeat(end - start)}${rest.slice(end)}`;
    };

    const definition = line.match(REFERENCE_DEFINITION);
    if (definition) {
      found.push({ url: definition[1]!, at: 0 });
      blank(0, line.length);
    }
    for (let index = rest.indexOf("]("); index >= 0; index = rest.indexOf("](", index + 2)) {
      const destination = readDestination(rest, index + 2);
      if (!destination) continue;
      found.push({ url: destination.url, at: index });
      blank(index, destination.end);
    }
    for (const pattern of [AUTOLINK, HTML_ATTRIBUTE]) {
      for (const match of rest.matchAll(pattern)) {
        found.push({ url: match[1]!, at: match.index });
        blank(match.index, match.index + match[0].length);
      }
    }
    for (const match of rest.matchAll(BARE_URL)) found.push({ url: trimBareUrl(match[0]), at: match.index });

    for (const { url } of found.sort((a, b) => a.at - b.at)) links.push({ url, line: number });
  }
  return links;
};

// Matches github-slugger, which the website and GitHub use: lower-case the text, drop everything
// except letters, marks, decimal and letter numbers, connector punctuation, spaces, and hyphens, then turn each space into a hyphen.
export const githubSlug = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{Nd}\p{Nl}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");

// Heading text as rendered: link and image text without the destination, no emphasis markers or HTML tags.
const headingText = (source: string) =>
  source
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`/g, "")
    .replace(/(^|[^\p{L}\p{N}])[*_]+|[*_]+(?=[^\p{L}\p{N}]|$)/gu, "$1")
    .trim();

/** Anchors a page provides: GitHub heading slugs, numbered like GitHub for repeats, and HTML ids. */
export const headingAnchors = (text: string) => {
  const anchors = new Set<string>();
  const counts = new Map<string, number>();
  const lines = splitLines(text);
  for (const { line } of proseLines(text)) {
    const original = lines[line - 1]!;
    const heading = original.match(HEADING);
    if (heading) {
      const slug = githubSlug(headingText(heading[2]!));
      let unique = slug;
      while (anchors.has(unique)) {
        const count = (counts.get(slug) ?? 0) + 1;
        counts.set(slug, count);
        unique = `${slug}-${count}`;
      }
      anchors.add(unique);
    }
    for (const match of original.matchAll(HTML_ID)) anchors.add(match[1]!);
  }
  return anchors;
};

/**
 * Sections that start at a heading, without their table rows, followed by each table row on its own.
 * Coverage checks look for related names inside one block, so `list` in the `projects` row does not count
 * for the `sessions` row of the same table.
 */
export const markdownBlocks = (text: string) => {
  const blocks: string[] = [];
  const lines = splitLines(text);
  const headingLines = new Set(
    proseLines(text)
      .filter(({ line }) => HEADING.test(lines[line - 1]!))
      .map(({ line }) => line - 1),
  );
  let section: string[] = [];
  const close = () => {
    const isRow = (line: string) => line.trimStart().startsWith("|");
    blocks.push(section.filter((line) => !isRow(line)).join("\n"));
    blocks.push(...section.filter((line) => isRow(line) && !TABLE_SEPARATOR.test(line)));
    section = [];
  };
  lines.forEach((line, index) => {
    if (headingLines.has(index)) close();
    section.push(line);
  });
  close();
  return blocks.filter((block) => block.trim() !== "");
};
