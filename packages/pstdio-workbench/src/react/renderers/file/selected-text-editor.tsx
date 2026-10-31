import type { PageParams } from "@pstdio/sdk/extensions";
import { AlertMessage } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { FileRendererContent, RegisteredFileRendererContribution, WorkbenchPanelRenderInput } from "../../../core";

export const selectedTextEditorInput = (
  input: WorkbenchPanelRenderInput,
  fileRendererId: string,
  ownerId: string,
  content: FileRendererContent,
  pageParams?: PageParams,
) => {
  const editor = content.textEditor;
  if (!editor || !content.textDocument) throw new Error("A selected text editor requires a declared text source");
  const viewId = `${editor.extensionId ?? ownerId}.view.${editor.id}`;
  return {
    ...input,
    instance: { ...input.instance, viewId },
    textTarget: { fileRendererId, resource: input.instance.resource, pageParams },
  };
};

interface SelectedTextEditorProps {
  presentationInput?: WorkbenchPanelRenderInput;
  contribution: RegisteredFileRendererContribution;
  open: boolean;
  content: FileRendererContent;
  pageParams?: PageParams;
}

export const SelectedTextEditor = (props: SelectedTextEditorProps) => {
  if (!props.open) return null;
  if (!props.presentationInput) return <AlertMessage status="error" title="The text source has no open presentation" />;
  const input = selectedTextEditorInput(
    props.presentationInput,
    props.contribution.id,
    props.contribution.ownerId,
    props.content,
    props.pageParams,
  );
  const view = input.workbench.views.getView(input.instance.viewId);
  if (view?.body.kind !== "react")
    return <AlertMessage status="error" title="The selected text editor is unavailable" />;
  return view.body.render(input) as ReactNode;
};
