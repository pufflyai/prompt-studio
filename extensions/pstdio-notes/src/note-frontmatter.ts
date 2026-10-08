import { findClosingFrontmatterDelimiter, quoteYamlScalar, unquoteYamlScalar } from "@pstdio/sdk/data";

export const parseNoteDocument = (source: string) => {
  const delimiter = /^---\r?\n/.test(source) ? findClosingFrontmatterDelimiter(source) : null;
  if (!delimiter) return { body: source, fields: "", title: undefined };
  const fields = source.slice(source.indexOf("\n") + 1, delimiter.start);
  const value = /^title:[ \t]*(.*)$/m.exec(fields)?.[1]?.trim();
  return {
    body: source.slice(delimiter.end).replace(/^\r?\n/, ""),
    fields,
    title: value === undefined ? undefined : unquoteYamlScalar(value),
  };
};

export const buildNoteDocument = (body: string, title: string, fields = "") => {
  const titleField = `title: ${quoteYamlScalar(title)}`;
  const nextFields = /^title:/m.test(fields) ? fields.replace(/^title:.*$/m, () => titleField) : `${titleField}\n${fields}`;
  const header = `---\n${nextFields.trimEnd()}\n---`;
  return body ? `${header}\n\n${body}` : header;
};

export const firstNoteTitle = (body: string) =>
  body
    .trimStart()
    .split(/\r?\n/, 1)[0]
    .replace(/^\s*(?:#{1,6}\s+|>\s+|[-*+]\s+|\d+[.)]\s+)/, "")
    .trim()
    .slice(0, 80);
