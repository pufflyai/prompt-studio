import { IconButton } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { runUserAction } from "../../core/shared/run-user-action";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const MainFullscreenControls = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const active = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  useWorkbenchStore(workbench.pages.store, (state) => state);
  const policy = usePanelPolicy(workbench, "side");
  if (!active && !workbench.fullscreen.canEnter()) return null;
  const sideLabel = policy.open ? "Hide Sidebar" : "Show Sidebar";
  const label = active ? "Exit fullscreen" : "Expand page";
  const command = active ? "exitMainFullscreen" : "enterMainFullscreen";
  return (
    <>
      {active && policy.floatable && (policy.open ? policy.canClose : policy.canOpen) && (
        <Tooltip content={sideLabel}>
          <IconButton
            data-workbench-fullscreen-side=""
            aria-label={sideLabel}
            aria-pressed={policy.open}
            size={PANEL_HEADER_CONTROL_SIZE}
            variant="ghost"
            onClick={() =>
              void runUserAction(workbench, sideLabel, () =>
                workbench.commands.executeCommand(`workbench.${policy.open ? "hide" : "show"}FullscreenSide`),
              )
            }
          >
            <WorkbenchIcon name="PanelRight" size={14} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip content={label}>
        <IconButton
          data-workbench-fullscreen-entry={active ? undefined : ""}
          aria-label={label}
          size={PANEL_HEADER_CONTROL_SIZE}
          variant="ghost"
          onClick={() =>
            void runUserAction(workbench, label, () => workbench.commands.executeCommand(`workbench.${command}`))
          }
        >
          <WorkbenchIcon name={active ? "Minimize" : "Maximize"} size={14} />
        </IconButton>
      </Tooltip>
    </>
  );
};
