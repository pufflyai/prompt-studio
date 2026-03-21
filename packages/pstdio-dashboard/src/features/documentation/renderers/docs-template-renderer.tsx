import { Box } from "@chakra-ui/react";
import { DocsChangelog, type DocsChangelogEntry } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";

type DocsTemplateRendererProps = {
  content: string;
  template?: string;
  markdownPlaceholder: string;
};

type ChangelogChange = {
  title: string;
  description?: string;
  link?: string;
};

type ParsedChangelog = {
  title: string;
  description?: string;
  entries: DocsChangelogEntry[];
};

type EntryParseState = {
  version: string;
  date: string;
  title: string;
  tags?: string[];
  image?: string;
  description?: string;
  changes: ChangelogChange[];
  inChanges: boolean;
};

const parseMetadataField = (line: string) => {
  const match = line.match(/^\*\*(\w+):\*\*\s*(.+)$/);
  if (!match) {
    return null;
  }

  return { key: match[1].toLowerCase(), value: match[2].trim() };
};

const parseChange = (line: string): ChangelogChange => {
  const cleaned = line.replace(/^-\s*/, "");

  const linkMatch = cleaned.match(/\[([^\]]+)\]\(([^)]+)\)/);
  const withoutLink = linkMatch ? cleaned.replace(linkMatch[0], "").trim() : cleaned;

  const parts = withoutLink.split(" — ");
  const rawTitle = parts[0].replace(/\*\*/g, "").trim();
  const description =
    parts.length > 1
      ? parts
          .slice(1)
          .join(" — ")
          .replace(/[.,]\s*$/, "")
          .trim()
      : undefined;

  return {
    title: rawTitle,
    ...(description ? { description } : {}),
    ...(linkMatch ? { link: linkMatch[2] } : {}),
  };
};

const parseHeader = (markdown: string) => {
  const lines = markdown.split("\n");
  let title = "Changelog";
  let description: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      title = trimmed.slice(2).trim();
      continue;
    }

    if (trimmed === "" || trimmed === "---") {
      continue;
    }

    if (trimmed.startsWith("## ")) {
      break;
    }

    description = trimmed;
    break;
  }

  return { title, description };
};

const createEntryParseState = (): EntryParseState => ({
  version: "",
  date: "",
  title: "",
  tags: undefined,
  image: undefined,
  description: undefined,
  changes: [],
  inChanges: false,
});

const applyEntryMetadata = (state: EntryParseState, key: string, value: string) => {
  switch (key) {
    case "date":
      state.date = value;
      return;
    case "title":
      state.title = value;
      return;
    case "tags":
      state.tags = value.split(",").map((tag) => tag.trim());
      return;
    case "image":
      state.image = value;
      return;
    default:
      return;
  }
};

const parseEntryLine = (state: EntryParseState, trimmed: string) => {
  if (trimmed.startsWith("## ")) {
    state.version = trimmed.slice(3).trim();
    return;
  }

  if (trimmed === "### Changes") {
    state.inChanges = true;
    return;
  }

  if (state.inChanges) {
    if (trimmed.startsWith("- ")) {
      state.changes.push(parseChange(trimmed));
    }
    return;
  }

  const field = parseMetadataField(trimmed);
  if (field) {
    applyEntryMetadata(state, field.key, field.value);
    return;
  }

  if (trimmed && !state.description && state.version) {
    state.description = trimmed;
  }
};

const parseEntry = (block: string) => {
  const state = createEntryParseState();

  for (const line of block.split("\n")) {
    parseEntryLine(state, line.trim());
  }

  if (!state.version) {
    return null;
  }

  return {
    version: state.version,
    date: state.date,
    title: state.title,
    ...(state.tags?.length ? { tags: state.tags } : {}),
    ...(state.image ? { image: state.image } : {}),
    ...(state.description ? { description: state.description } : {}),
    ...(state.changes.length ? { changes: state.changes } : {}),
  } satisfies DocsChangelogEntry;
};

export const parseChangelogMarkdown = (markdown: string): ParsedChangelog => {
  const { title, description } = parseHeader(markdown);
  const entries = markdown
    .split(/^---$/m)
    .slice(1)
    .map((block) => parseEntry(block))
    .filter((entry): entry is DocsChangelogEntry => entry !== null);

  return { title, ...(description ? { description } : {}), entries };
};

export const DocsTemplateRenderer = (props: DocsTemplateRendererProps) => {
  const { content, template, markdownPlaceholder } = props;

  if (template === "changelog") {
    const changelog = parseChangelogMarkdown(content);
    return (
      <Box py="16" px={{ base: "6", md: "10" }} maxW="4xl" mx="auto" width="100%">
        <DocsChangelog title={changelog.title} description={changelog.description} entries={changelog.entries} />
      </Box>
    );
  }

  return <MarkdownEditor defaultState={content} isEditable={false} placeholder={markdownPlaceholder} />;
};
