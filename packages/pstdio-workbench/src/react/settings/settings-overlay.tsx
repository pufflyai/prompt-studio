import { Box, Flex, Text } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { PreferenceScope, SettingsRegistry, WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchTreeView } from "../renderers/tree/tree-view";
import { WorkbenchIcon } from "../shared/icon";
import { SettingsSurfacePanel } from "./settings-surface-panel";
import { useSettingsRevision } from "./use-settings-revision";

export interface SettingsOverlayProps {
  input: WorkbenchPanelRenderInput;
  settings: SettingsRegistry;
  navTreeId: string;
  title: string;
  resolveScopeId?: (scope: PreferenceScope) => string | undefined;
}

// The settings surface rendered inside the overlay dialog: a titled header bar,
// then a full-height resizable nav on the left and the dispatching panel on the
// right. Nav clicks route through openResource, which re-opens this singleton
// overlay with the new resource — selection stays resource-driven and the dialog
// never closes mid-navigation.
export const SettingsOverlay = (props: SettingsOverlayProps) => {
  const { input, settings, navTreeId, title, resolveScopeId } = props;
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
    <Flex direction="column" position="absolute" inset="0" minH="0" minW="0" overflow="hidden">
      <Flex
        align="center"
        bg="bg.subtle"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        flexShrink={0}
        gap="2"
        h="12"
        px="3.5"
      >
        <Box color="fg.accent" display="inline-flex">
          <WorkbenchIcon name="settings" size={16} />
        </Box>
        <Text fontWeight="semibold" textStyle="sm">
          {title}
        </Text>
      </Flex>
      <Box flex="1" minH="0" minW="0" position="relative" overflow="hidden">
        <ResizableSplitLayout
          position="absolute"
          inset="0"
          minH="0"
          minW="0"
          resizableSide="left"
          resizablePanel={nav}
          contentPanel={content}
          defaultSizePx={280}
          minSizePx={220}
          maxSizePx={420}
          contentMinSizePx={360}
          collapsible={false}
          resizeLabel="Resize settings navigation"
          showResizeSeparator
        />
      </Box>
    </Flex>
  );
};
