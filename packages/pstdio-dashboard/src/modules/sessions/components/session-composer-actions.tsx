import type { ComponentProps, ReactNode } from "react";
import { SessionAttachmentControls } from "./session-attachment-controls";
import { SessionModelControls } from "./session-model-controls";

interface SessionComposerActionsProps extends ComponentProps<typeof SessionModelControls> {
  uploading: boolean;
  onAttachFiles: (files: File[]) => void;
  children?: ReactNode;
}
export const SessionComposerActions = (props: SessionComposerActionsProps) => {
  const { uploading, onAttachFiles, children, ...model } = props;
  return (
    <>
      <SessionAttachmentControls projectId={model.projectId} uploading={uploading} onAttachFiles={onAttachFiles} />
      <SessionModelControls {...model} />
      {children}
    </>
  );
};
