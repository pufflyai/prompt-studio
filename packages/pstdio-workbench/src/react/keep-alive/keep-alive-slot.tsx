import { useLayoutEffect, useRef } from "react";
import {
  WORKBENCH_KEEP_ALIVE_SLOT_RENDERER_ID,
  type WorkbenchCore,
  type WorkbenchKeepAliveSlotConfig,
  type WorkbenchWidgetRenderInput,
} from "../../core";

interface WorkbenchKeepAliveSlotProps {
  workbench: WorkbenchCore;
  keepAliveId: string;
}

// Bridge widget body. The slot div stays empty in React; on mount we call
// `keepAlive.claim(id, slot)` which moves the host into the slot via
// appendChild — outside React's reconciliation, so the kept-alive subtree
// is not re-mounted.
export const WorkbenchKeepAliveSlot = (props: WorkbenchKeepAliveSlotProps) => {
  const { workbench, keepAliveId } = props;
  const slotRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const claim = workbench.keepAlive.claim(keepAliveId, slot);
    return () => claim.dispose();
  }, [workbench, keepAliveId]);

  return <div ref={slotRef} style={{ display: "contents" }} data-workbench-keep-alive-slot={keepAliveId} />;
};

export const registerWorkbenchKeepAliveSlotRenderer = (workbench: WorkbenchCore) => {
  if (workbench.renderers.getRenderer(WORKBENCH_KEEP_ALIVE_SLOT_RENDERER_ID)) return undefined;

  return workbench.renderers.registerRenderer({
    id: WORKBENCH_KEEP_ALIVE_SLOT_RENDERER_ID,
    render: (input: WorkbenchWidgetRenderInput) => {
      const config = input.widget.config as WorkbenchKeepAliveSlotConfig | undefined;
      const keepAliveId = config?.keepAliveId;
      if (!keepAliveId) {
        throw new Error(
          `Widget ${input.widget.id} uses ${WORKBENCH_KEEP_ALIVE_SLOT_RENDERER_ID} but is missing config.keepAliveId`,
        );
      }
      return <WorkbenchKeepAliveSlot workbench={input.workbench} keepAliveId={keepAliveId} />;
    },
  });
};
