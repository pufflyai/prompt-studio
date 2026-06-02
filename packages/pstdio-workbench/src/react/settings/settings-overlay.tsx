import { Box, Flex } from "@chakra-ui/react";
import { Breadcrumb, type BreadcrumbItem, ResizableSplitLayout } from "@pstdio/ui";
import type { PreferenceScope, ResourceRef, SettingsRegistry, WorkbenchWidgetRenderInput } from "../../core";
import { WorkbenchTreeView } from "../renderers/tree/tree-view";
import { SettingsSurfacePanel } from "./settings-surface-panel";
import { useSettingsRevision } from "./use-settings-revision";

export interface SettingsOverlayProps {
  input: WorkbenchWidgetRenderInput;
  settings: SettingsRegistry;
  navTreeId: string;
  title: string;
  resolveScopeId?: (scope: PreferenceScope) => string | undefined;
}

// The breadcrumb trail for the open entry: title -> section -> panel -> item.
const buildBreadcrumbItems = (settings: SettingsRegistry, title: string, resource?: ResourceRef): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [{ title }];
  const panelId = typeof resource?.metadata?.panelId === "string" ? resource.metadata.panelId : undefined;
  const panel = panelId ? settings.getPanel(panelId) : undefined;
  if (!panel) return items;

  const section = panel.section ? settings.getSection(panel.section) : undefined;
  if (section?.title) items.push({ title: section.title });
  items.push({ title: panel.title });

  const itemId = typeof resource?.metadata?.itemId === "string" ? resource.metadata.itemId : undefined;
  if (itemId && resource?.label && resource.label !== panel.title) items.push({ title: resource.label });

  return items;
};

// The full-window settings surface rendered inside the overlay dialog: a
// full-height resizable nav on the left and a content column (breadcrumb header
// + dispatching panel) on the right. Nav clicks route through openResource, which
// re-opens this singleton overlay with the new resource — selection stays
// resource-driven and the dialog never closes mid-navigation.
export const SettingsOverlay = (props: SettingsOverlayProps) => {
  const { input, settings, navTreeId, title, resolveScopeId } = props;
  useSettingsRevision(settings);
  const resource = input.placement.resource;

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
    <Flex direction="column" flex="1" h="full" minH="0" minW="0">
      {/* pr leaves room for the dialog's absolute close button. */}
      <Flex
        align="center"
        flexShrink={0}
        px="md"
        py="sm"
        pr="3xl"
        minW="0"
        borderBottomWidth="1px"
        borderColor="border.muted"
      >
        <Breadcrumb items={buildBreadcrumbItems(settings, title, resource)} separator="/" separatorGap="xs" />
      </Flex>
      <Box flex="1" minH="0">
        <SettingsSurfacePanel input={input} settings={settings} resolveScopeId={resolveScopeId} />
      </Box>
    </Flex>
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
