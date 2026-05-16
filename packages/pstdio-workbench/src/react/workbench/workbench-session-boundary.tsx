import { Flex } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchAttachedSessionLayout } from "./workbench-session-layout";

interface WorkbenchSessionBoundaryProps {
  workbench: WorkbenchCore;
  showAttachedSessionPanel: boolean;
  workbenchFrame: ReactNode;
  floatingHeader: ReactNode;
  contentMinSizePx: number;
  onAttachedSlotChange(slot: HTMLDivElement | null): void;
}

interface WorkbenchKeyboardFrameProps {
  children: ReactNode;
}

const focusWorkbenchKeyboardFrame = (element: HTMLDivElement | null) => {
  element?.focus({ preventScroll: true });
};

const WorkbenchKeyboardFrame = (props: WorkbenchKeyboardFrameProps) => {
  const { children } = props;
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    focusWorkbenchKeyboardFrame(ref.current);
  }, []);

  return (
    <Flex
      ref={ref}
      h="100vh"
      minH="0"
      minW="0"
      w="full"
      tabIndex={-1}
      outline="none"
      onPointerDown={(event) => focusWorkbenchKeyboardFrame(event.currentTarget)}
    >
      {children}
    </Flex>
  );
};

export const WorkbenchSessionBoundary = (props: WorkbenchSessionBoundaryProps) => {
  const {
    workbench,
    showAttachedSessionPanel,
    workbenchFrame,
    floatingHeader,
    contentMinSizePx,
    onAttachedSlotChange,
  } = props;

  if (!showAttachedSessionPanel) {
    return <WorkbenchKeyboardFrame>{workbenchFrame}</WorkbenchKeyboardFrame>;
  }

  return (
    <WorkbenchKeyboardFrame>
      <WorkbenchAttachedSessionLayout
        workbench={workbench}
        contentPanel={workbenchFrame}
        contentMinSizePx={contentMinSizePx}
        header={floatingHeader}
        onAttachedSlotChange={onAttachedSlotChange}
        onCollapseToBubble={() => workbench.sessionPanel.setMode("bubble")}
      />
    </WorkbenchKeyboardFrame>
  );
};
