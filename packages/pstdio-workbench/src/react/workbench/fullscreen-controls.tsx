import { HStack, IconButton } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { useLayoutEffect, useRef } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const FullscreenControls = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const { active, sideOpen } = useWorkbenchStore(workbench.fullscreen.store, (state) => state);
  const policy = usePanelPolicy(workbench, "side");
  const exitRef = useRef<HTMLButtonElement>(null);
  const sideRef = useRef<HTMLButtonElement>(null);
  const previous = useRef({ active, sideOpen });
  useLayoutEffect(() => {
    if (previous.current.active && !active) exitRef.current?.focus({ preventScroll: true });
    else if (active && previous.current.sideOpen && !sideOpen) sideRef.current?.focus({ preventScroll: true });
    previous.current = { active, sideOpen };
  }, [active, sideOpen]);
  const label = active ? "Exit Main fullscreen" : "Enter Main fullscreen";
  const sideLabel = sideOpen ? "Hide fullscreen Side Panel" : "Show fullscreen Side Panel";
  return (
    <HStack gap="2xs" flexShrink={0}>
      {active && policy.provided && policy.floatable && (sideOpen ? policy.canClose : policy.canOpen) ? (
        <Tooltip content={sideLabel}>
          <IconButton
            ref={sideRef}
            size={PANEL_HEADER_CONTROL_SIZE}
            variant="ghost"
            aria-label={sideLabel}
            aria-pressed={sideOpen}
            onClick={() =>
              workbench.commands.executeCommand(
                sideOpen ? "workbench.hideFullscreenSide" : "workbench.showFullscreenSide",
              )
            }
          >
            <WorkbenchIcon name="PanelRight" size={14} />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip content={label}>
        <IconButton
          ref={exitRef}
          size={PANEL_HEADER_CONTROL_SIZE}
          variant="ghost"
          aria-label={label}
          aria-pressed={active}
          onClick={() =>
            workbench.commands.executeCommand(active ? "workbench.exitMainFullscreen" : "workbench.enterMainFullscreen")
          }
        >
          <WorkbenchIcon name={active ? "Minimize" : "Maximize"} size={14} />
        </IconButton>
      </Tooltip>
    </HStack>
  );
};

/** Let menus and dialogs consume Escape before leaving the presentation. */
export const FullscreenKeyboard = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  useLayoutEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || !workbench.fullscreen.store.getState().active) return;
      if (workbench.commandPalette.store.getState().open) return;
      const target = event.target instanceof Element ? event.target : undefined;
      if (target?.closest('[role="menu"], [role="listbox"], [role="dialog"]:not([data-workbench-panel="side"])'))
        return;
      event.preventDefault();
      const { sideOpen } = workbench.fullscreen.store.getState();
      if (sideOpen && workbench.shell.getPanelPolicy("side").canClose) workbench.fullscreen.hideSide();
      else workbench.fullscreen.exit();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [workbench]);
  return null;
};
