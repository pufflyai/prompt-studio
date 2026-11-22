import { BubbleButton, ResourceContextMenu } from "@pstdio/ui";
import { MessageCircle } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import type { WorkbenchCore } from "../../core";
import { openSidePanelBubble } from "../../core/controllers/side-panel/side-panel-bubble";
import { runUserAction } from "../../core/shared/run-user-action";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useSidePanelPosition } from "./use-side-panel-position";

interface SidePanelBubbleProps {
  workbench: WorkbenchCore;
  buttonRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  bottom: string;
  icon?: ReactNode;
  onOpen?: () => void | Promise<void>;
}

export const SidePanelBubble = (props: SidePanelBubbleProps) => {
  const { workbench, buttonRef, isOpen, bottom, icon, onOpen } = props;
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  const position = useSidePanelPosition(workbench);
  return (
    <ResourceContextMenu actions={position.actions}>
      <BubbleButton
        ref={buttonRef}
        isOpen={isOpen}
        aria-label="Open Side Panel"
        tooltip="Open Side Panel"
        aria-keyshortcuts="Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
        data-side-panel-bubble-alignment={position.alignment}
        containerProps={{ ...position.frameProps, bottom, w: "fit-content" }}
        {...position.dragProps}
        onClick={(event) => {
          if (position.consumeClick()) {
            event.preventDefault();
            return;
          }
          void runUserAction(workbench, "Open Side Panel", () =>
            fullscreen
              ? workbench.commands.executeCommand("workbench.showFullscreenSide")
              : openSidePanelBubble(workbench, onOpen),
          );
        }}
      >
        {icon ?? <MessageCircle size={20} strokeWidth={2} />}
      </BubbleButton>
    </ResourceContextMenu>
  );
};
