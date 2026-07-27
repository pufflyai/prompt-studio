import { Box } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { PreferenceScope, SettingsRegistry, WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchTreeView } from "../renderers/tree/tree-view";
import { SettingsSurfacePanel } from "./settings-surface-panel";
import { useSettingsRevision } from "./use-settings-revision";

export interface SettingsOverlayProps {
  input: WorkbenchPanelRenderInput;
  settings: SettingsRegistry;
  navTreeId: string;
  title: string;
  resolveScopeId?: (scope: PreferenceScope) => string | undefined;
}

// The settings surface rendered inside the overlay dialog: a full-height
// resizable nav on the left and the dispatching panel on the right. Nav clicks
// route through openResource, which re-opens this singleton overlay with the new
// resource — selection stays resource-driven and the dialog never closes
// mid-navigation.
export const SettingsOverlay = (props: SettingsOverlayProps) => {
  const { input, settings, navTreeId, resolveScopeId } = props;
  useSettingsRevision(settings);
  const resource = input.instance.resource;

  const nav = (
    <Box h="full" minH="0" minW="0" w="full" bg="bg.subtle">
      <WorkbenchTreeView
        workbench={input.workbench}
        treeViewId={navTreeId}
        resource={resource}
        activeNodeId={resource?.uri}
      />
    </Box>
  );

  const content = (
    <Box flex="1" h="full" minH="0" minW="0">
      <SettingsSurfacePanel input={input} settings={settings} resolveScopeId={resolveScopeId} />
    </Box>
  );

  return (
    <ResizableSplitLayout
      position="absolute"
      inset="0"
      minH="0"
      minW="0"
      resizableSide="left"
      resizablePanel={nav}
      contentPanel={content}
      defaultSizePx={260}
      minSizePx={220}
      maxSizePx={420}
      contentMinSizePx={360}
      collapsible={false}
      resizeLabel="Resize settings navigation"
      showResizeSeparator
    />
  );
};
