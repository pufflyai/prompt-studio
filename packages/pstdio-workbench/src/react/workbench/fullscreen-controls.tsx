import { IconButton } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { useLayoutEffect, useRef } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchShortcutHint } from "../keybindings/shortcut-hint";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useWorkbenchRegionContent } from "./use-workbench-region-content";

export const FullscreenControls = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const active = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  const allowed = useWorkbenchStore(workbench.modes.store, () => workbench.fullscreen.canEnter());
  const hasMain = useWorkbenchRegionContent(workbench, "main", { locationScoped: true });
  const exitRef = useRef<HTMLButtonElement>(null);
  const previous = useRef(active);
  useLayoutEffect(() => {
    if (previous.current && !active) exitRef.current?.focus({ preventScroll: true });
    previous.current = active;
  }, [active]);
  if (!active && (!allowed || !hasMain)) return null;
  const label = active ? "Exit Main fullscreen" : "Enter Main fullscreen";
  return (
    <Tooltip
      content={
        <WorkbenchShortcutHint
          workbench={workbench}
          action={{ kind: "command", commandId: "workbench.toggleMainFullscreen" }}
        >
          {label}
        </WorkbenchShortcutHint>
      }
    >
      <IconButton
        ref={exitRef}
        size={PANEL_HEADER_CONTROL_SIZE}
        variant="ghost"
        aria-label={label}
        aria-pressed={active}
        onClick={() => workbench.commands.executeCommand("workbench.toggleMainFullscreen")}
      >
        <WorkbenchIcon name={active ? "Minimize" : "Maximize"} size={14} />
      </IconButton>
    </Tooltip>
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
