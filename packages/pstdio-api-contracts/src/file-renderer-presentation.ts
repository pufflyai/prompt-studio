import type { FileRendererLoadResult } from "./extension-kernel/types/file-renderer";
import { codeLanguageFor, pickFileKind } from "./file-kind";

export type FileRendererPresentation =
  | { kind: "empty"; isEditable: false }
  | { kind: "image"; isEditable: false }
  | { kind: "code"; isEditable: boolean; language: string }
  | { kind: "markdown"; isEditable: boolean };

export const resolveFileRendererPresentation = (
  content: FileRendererLoadResult,
  contributionCanSave: boolean,
): FileRendererPresentation => {
  if (content.emptyState) return { kind: "empty", isEditable: false };

  const automaticKind = pickFileKind(content.fileName, content.mimeType);
  if (automaticKind === "image") return { kind: "image", isEditable: false };

  const isEditable = contributionCanSave && content.editable !== false;
  const language = codeLanguageFor(content.fileName);
  // Unknown-format documents need the shared editor when their source owns loading or saving.
  const reliesOnSharedSource =
    (content.content === undefined || !contributionCanSave) &&
    Boolean(content.textDocument || content.documentSource) &&
    language === "plaintext";
  if ((automaticKind === "code" && !reliesOnSharedSource) || content.textRenderer === "monaco") {
    return { kind: "code", isEditable, language };
  }
  return { kind: "markdown", isEditable };
};
