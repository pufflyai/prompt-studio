import { isMap, isSeq, parseDocument } from "yaml";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const versionText = (value: unknown) => (typeof value === "number" ? String(value) : text(value));

export const parseSkillMetadata = (content: string) => {
  const empty = { name: "", version: "", description: "" };
  const frontmatter = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(content)?.[1];
  if (!frontmatter) return empty;
  const document = parseDocument(frontmatter);
  if (document.errors.length || !isMap(document.contents)) return empty;
  const metadata = document.get("metadata");
  let metadataVersion: unknown;
  if (isMap(metadata)) metadataVersion = metadata.get("version");
  if (isSeq(metadata)) {
    const entry = metadata.items.find((item) => isMap(item) && item.has("version"));
    if (isMap(entry)) metadataVersion = entry.get("version");
  }
  return {
    name: text(document.get("name")),
    version: versionText(document.get("version")) || versionText(metadataVersion),
    description: text(document.get("description")),
  };
};
