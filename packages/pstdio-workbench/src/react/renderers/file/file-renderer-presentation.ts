import type { FileRendererContent } from "../../../core";
import { codeLanguageFor, pickFileKind } from "./file-kind";

export type FileRendererPresentation =
  | { kind: "empty"; isEditable: false }
  | { kind: "image"; isEditable: false }
  | { kind: "code"; isEditable: boolean; language: string }
  | { kind: "markdown"; isEditable: boolean };

export const resolveFileRendererPresentation = (
  content: FileRendererContent,
  contributionCanSave: boolean,
): FileRendererPresentation => {
  if (content.emptyState) return { kind: "empty", isEditable: false };

  const automaticKind = pickFileKind(content.fileName, content.mimeType);
  if (automaticKind === "image") return { kind: "image", isEditable: false };

  const isEditable = contributionCanSave && content.editable !== false;
  if (automaticKind === "code" || content.textRenderer === "monaco") {
    return { kind: "code", isEditable, language: codeLanguageFor(content.fileName) };
  }
  return { kind: "markdown", isEditable };
};
