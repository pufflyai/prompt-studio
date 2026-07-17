import { Flex } from "@chakra-ui/react";
import { Toaster } from "@pstdio/ui";
import type { Frame, FrameSlot, WorkbenchCore } from "../../core";
import { WorkbenchCommandPalette } from "../command-palette/command-palette";
import type { CommandParamFieldRenderer } from "../command-palette/command-params-dialog";
import { resolveFrameShell } from "../frame/frame-shell";
import { FrameView } from "../frame/frame-view";
import { useFrameSlotState } from "../frame/use-frame-slot-state";
import { WorkbenchKeepAliveLayer } from "../keep-alive/workbench-keep-alive-layer";
import { WorkbenchKeybindingDispatcher } from "../keybindings/workbench-keybinding-dispatcher";
import { WorkbenchNotificationHost } from "../notifications/notification-host";
import { installWorkbenchControlsRenderer } from "../renderers/controls/install-controls-renderer";
import { installWorkbenchDataRenderer } from "../renderers/data/install-data-renderer";
import { installWorkbenchDataTableRenderer } from "../renderers/data-table/install-data-table-renderer";
import { installWorkbenchFileRenderer } from "../renderers/file/install-file-renderer";
import { installWorkbenchTreeRenderer } from "../renderers/tree/install-tree-renderer";
import { SettingsOverlay } from "../settings/settings-overlay";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useWorkbenchFileIconThemePreferences } from "../theme/use-workbench-file-icon-theme-preferences";
import { useWorkbenchThemePreferences } from "../theme/use-workbench-theme-preferences";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchThemeScope } from "../theme/workbench-theme-scope";
import { WorkbenchOverlayLayer } from "./overlay-layer";
import { WorkbenchKeyboardFrame } from "./workbench-keyboard-frame";
import { WorkbenchSidePanel } from "./workbench-side-panel";

interface WorkbenchProps {
  workbench: WorkbenchCore;
  renderParamField?: CommandParamFieldRenderer;
}

interface FloatingFrameSlotProps {
  frame: Frame;
  slot: FrameSlot;
  workbench: WorkbenchCore;
}

const FloatingFrameSlot = (props: FloatingFrameSlotProps) => {
  const { frame, slot, workbench } = props;
  const state = useFrameSlotState(workbench, slot);
  if (!state.has || state.collapsed) return null;
  if (slot.id === frame.attached?.slot) {
    return <WorkbenchSidePanel workbench={workbench} presentation="floating" />;
  }
  return null;
};

const WorkbenchContent = (props: WorkbenchProps) => {
  const { workbench, renderParamField } = props;
  installWorkbenchTreeRenderer(workbench, { renderParamField });
  installWorkbenchDataRenderer(workbench);
  installWorkbenchDataTableRenderer(workbench);
  installWorkbenchFileRenderer(workbench);
  installWorkbenchControlsRenderer(workbench);
  const frame = useWorkbenchStore(workbench.layout.store, (state) => state.frame);
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const paletteOpen = useWorkbenchStore(workbench.commandPalette.store, (state) => state.open);
  const paletteInitialQuery = useWorkbenchStore(workbench.commandPalette.store, (state) => state.initialQuery);
  const shell = resolveFrameShell(frame, layout.nodes);

  return (
    <WorkbenchThemeScope h="full" minH="0" minW="0" w="full">
      <WorkbenchKeyboardFrame>
        <Flex
          direction="column"
          position="relative"
          h="full"
          minH="0"
          minW="0"
          w="full"
          overflow="hidden"
          bg={workbenchBackgrounds.main}
          color="fg"
        >
          {shell.flow ? <FrameView workbench={workbench} frame={frame} node={shell.flow} /> : null}
          {shell.transient.some((slot) => slot.id === "overlay") ? (
            <WorkbenchOverlayLayer workbench={workbench} />
          ) : null}
          <WorkbenchCommandPalette
            workbench={workbench}
            open={paletteOpen}
            initialQuery={paletteInitialQuery}
            renderParamField={renderParamField}
            onClose={() => workbench.commandPalette.close()}
          />
          <SettingsOverlay workbench={workbench} />
          <WorkbenchKeybindingDispatcher workbench={workbench} />
          <WorkbenchNotificationHost workbench={workbench} />
        </Flex>
      </WorkbenchKeyboardFrame>
      {shell.floating.map((slot) => (
        <FloatingFrameSlot key={slot.id} workbench={workbench} frame={frame} slot={slot} />
      ))}
      {/* Kept-alive renderer portals sit at the workbench root so their hosts
          stay stable while widget slots and side panel containers move. */}
      <WorkbenchKeepAliveLayer workbench={workbench} />
    </WorkbenchThemeScope>
  );
};

export const Workbench = (props: WorkbenchProps) => {
  const themePreferences = useWorkbenchThemePreferences(props.workbench);
  const fileIconThemePreferences = useWorkbenchFileIconThemePreferences(props.workbench);

  return (
    <WorkbenchThemeProvider themePreferences={themePreferences} fileIconThemePreferences={fileIconThemePreferences}>
      <WorkbenchContent {...props} />
      <Toaster />
    </WorkbenchThemeProvider>
  );
};
