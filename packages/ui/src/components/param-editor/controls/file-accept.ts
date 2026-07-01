import type { FileDropValue } from "../param-editor.types";

interface AcceptClause {
  kind: "extension" | "mime" | "wildcard";
  value: string;
}

/** Parse an accept string ("image/*,.png,image/jpeg") into normalized clauses. */
export const parseAccept = (accept?: string): AcceptClause[] => {
  if (!accept) return [];
  return accept
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith(".")) return { kind: "extension", value: entry };
      if (entry.endsWith("/*")) return { kind: "wildcard", value: entry.slice(0, entry.indexOf("/")) };
      return { kind: "mime", value: entry };
    });
};

export interface AcceptCandidate {
  name: string;
  mimeType?: string;
}

/** Whether a file satisfies the accept string. An empty accept matches anything. */
export const acceptsFile = (candidate: AcceptCandidate, accept?: string) => {
  const clauses = parseAccept(accept);
  if (clauses.length === 0) return true;
  const name = candidate.name.toLowerCase();
  const mime = candidate.mimeType?.toLowerCase();
  return clauses.some((clause) => {
    if (clause.kind === "extension") return name.endsWith(clause.value);
    if (clause.kind === "wildcard") return Boolean(mime?.startsWith(`${clause.value}/`));
    return mime === clause.value;
  });
};

interface FileMetadataInput {
  name: string;
  type?: string;
  size?: number;
  dataUrl?: string;
}

/** Build the serializable metadata a file-drop control commits (never a live File). */
export const fileDropValueFromFile = (input: FileMetadataInput): FileDropValue => ({
  name: input.name,
  mimeType: input.type || undefined,
  size: input.size,
  dataUrl: input.dataUrl,
});
