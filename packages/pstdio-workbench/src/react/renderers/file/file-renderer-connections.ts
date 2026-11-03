import type { PageParams } from "@pstdio/sdk/extensions";
import type {
  RegisteredFileRendererContribution,
  WorkbenchPanelInstance,
  WorkbenchPanelRenderInput,
} from "../../../core";
import type { LoadedFile } from "./file-renderer-load-state";
import { resolveFileRendererPresentation } from "./file-renderer-presentation";

export const getNativeMarkdownConnection = (
  contribution: RegisteredFileRendererContribution,
  file: LoadedFile | null,
  resource: WorkbenchPanelInstance["resource"],
  pageParams: PageParams | undefined,
) => {
  const connect = contribution.connectDocument;
  if (contribution.saveMode === "manual" || !file?.documentSource || !connect) return undefined;
  const presentation = resolveFileRendererPresentation(file, Boolean(contribution.save));
  if (presentation.kind !== "markdown" || !presentation.isEditable) return undefined;
  return () => connect(resource, pageParams);
};
export const getPublicMarkdownConnection = (
  contribution: RegisteredFileRendererContribution,
  file: LoadedFile | null,
  input: WorkbenchPanelRenderInput | undefined,
  pageParams: PageParams | undefined,
) => {
  const connect = contribution.connectText;
  if (contribution.saveMode === "manual" || !file || !input || !connect) return undefined;
  const presentation = resolveFileRendererPresentation(file, Boolean(contribution.save));
  if (presentation.kind !== "markdown") return undefined;
  if (!file.textDocument && !(file.documentSource && presentation.isEditable)) return undefined;
  return () => connect(input, pageParams);
};
