import type { ComponentProps, ReactNode } from "react";
import { SessionModelControls } from "./session-model-controls";

interface SessionComposerActionsProps extends ComponentProps<typeof SessionModelControls> {
  children?: ReactNode;
}
export const SessionComposerActions = (props: SessionComposerActionsProps) => {
  const { children, ...model } = props;
  return (
    <>
      <SessionModelControls {...model} />
      {children}
    </>
  );
};
