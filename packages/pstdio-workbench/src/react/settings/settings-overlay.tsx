import { Box, Dialog, Portal } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type {
  RegisteredWidgetContribution,
  SettingsSurfaceContribution,
  WorkbenchCore,
  WorkbenchWidgetPlacement,
  WorkbenchWidgetRenderInput,
} from "../../core";
import { WorkbenchTreeView } from "../renderers/tree/tree-view";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { SettingsSurfacePanel } from "./settings-surface-panel";
import { useSettingsRevision } from "./use-settings-revision";

export interface SettingsOverlayProps {
  workbench: WorkbenchCore;
}

const SETTINGS_SURFACE_ID = "workbench.settings.surface";

const createRenderInput = (
  workbench: WorkbenchCore,
  surface: SettingsSurfaceContribution,
  resource: WorkbenchWidgetPlacement["resource"],
): WorkbenchWidgetRenderInput => {
  const widget = {
    id: SETTINGS_SURFACE_ID,
    title: surface.title,
    area: "settings",
    singleton: true,
    reuse: "none",
    closable: true,
    rendererId: SETTINGS_SURFACE_ID,
    source: "module",
    ownerId: SETTINGS_SURFACE_ID,
    priority: 0,
  } satisfies RegisteredWidgetContribution;
  const placement = {
    widgetId: SETTINGS_SURFACE_ID,
    contributionId: SETTINGS_SURFACE_ID,
    ownerId: SETTINGS_SURFACE_ID,
    source: "module",
    resource,
    resourceUri: resource?.uri,
    title: resource?.label ?? surface.title,
    closable: true,
  } satisfies WorkbenchWidgetPlacement;

  return { workbench, widget, placement, refresh: () => workbench.settings.refresh() };
};

export const SettingsOverlay = (props: SettingsOverlayProps) => {
  const { workbench } = props;
  const settings = workbench.settings;
  const surface = useWorkbenchStore(settings.store, (state) => state.surface);
  const open = useWorkbenchStore(settings.store, (state) => state.open);
  const resource = useWorkbenchStore(settings.store, (state) => state.activeResource);
  useSettingsRevision(settings);

  if (!surface || !resource) return null;

  const input = createRenderInput(workbench, surface, resource);
  const nav = (
    <Box h="full" minH="0" minW="0" w="full" bg="bg.subtle">
      <WorkbenchTreeView
        workbench={workbench}
        treeViewId={surface.navigationTreeId}
        resource={resource}
        activeNodeId={resource.uri}
      />
    </Box>
  );
  const content = (
    <Box flex="1" h="full" minH="0" minW="0">
      <SettingsSurfacePanel input={input} settings={settings} resolveScopeId={surface.resolveScopeId} />
    </Box>
  );

  return (
    <Dialog.Root
      open={open}
      size="xl"
      scrollBehavior="inside"
      modal
      preventScroll
      trapFocus
      onOpenChange={(details) => {
        if (!details.open) settings.close();
      }}
    >
      <Portal>
        <Dialog.Backdrop position="fixed" inset="0" />
        <Dialog.Positioner position="fixed" inset="0" overflow="auto">
          <Dialog.Content position="relative" overflow="hidden" borderWidth="1px" borderColor="border.subtle" h="80vh">
            <Dialog.Title srOnly>{surface.title}</Dialog.Title>
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
            <Dialog.CloseTrigger
              aria-label={`Close ${surface.title}`}
              alignItems="center"
              borderRadius="sm"
              color="fg.muted"
              cursor="pointer"
              display="inline-flex"
              h="5"
              insetEnd="1"
              justifyContent="center"
              position="absolute"
              top="1"
              w="5"
              zIndex="1"
              _hover={{ bg: "bg.subtle", color: "fg" }}
            >
              <WorkbenchIcon name="x" size={16} />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
