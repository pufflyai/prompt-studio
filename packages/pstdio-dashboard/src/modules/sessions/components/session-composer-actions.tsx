import type { ComponentProps, ReactNode } from "react";
import { SessionModelControls } from "./session-model-controls";
import { SessionRemoteModelControls } from "./session-remote-model-controls";

interface SessionComposerActionsProps extends ComponentProps<typeof SessionModelControls> {
  children?: ReactNode;
  remote?: boolean;
}
export const SessionComposerActions = (props: SessionComposerActionsProps) => {
  const { children, remote, ...model } = props;
  return (
    <>
      {remote && model.view.sessionId ? (
        <SessionRemoteModelControls
          projectId={model.projectId}
          agent={model.selectedAgent}
          model={model.selectedModel}
        />
      ) : (
        <SessionModelControls {...model} remote={remote} />
      )}
      {children}
    </>
  );
};
