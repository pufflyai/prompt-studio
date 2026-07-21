import { Badge, Button, Code, HStack, Menu, Stack, Text } from "@chakra-ui/react";
import { ListRow, ScrollArea } from "@pstdio/ui";
import { getAnchorResource, type ResourceRef, type WorkbenchCore, type WorkbenchModuleContribution } from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";
import { findSidePanelItem, SIDE_PANEL_ITEM_KIND, sidePanelItemResource, sidePanelItems } from "./side-panels-data";
import { ResourceInspector } from "./side-panels-inspector";
import { registerSidePanelMenuExamples, sidePanelMenuDefinitions } from "./side-panels-menus";
import { ResourceActivityPanel } from "./side-panels-secondary";

const RESOURCE_PICKER_WIDGET_ID = "onboarding.side-panels.resources";
const RESOURCE_PICKER_RENDERER_ID = "onboarding.side-panels.resources.renderer";
const CONTEXT_WIDGET_ID = "onboarding.side-panels.context";
const CONTEXT_RENDERER_ID = "onboarding.side-panels.context.renderer";
const DETAIL_WIDGET_ID = "onboarding.side-panels.detail";
const DETAIL_RENDERER_ID = "onboarding.side-panels.detail.renderer";
const INSPECTOR_WIDGET_ID = "onboarding.side-panels.inspector";
const INSPECTOR_RENDERER_ID = "onboarding.side-panels.inspector.renderer";
const ACTIVITY_WIDGET_ID = "onboarding.side-panels.activity";
const ACTIVITY_RENDERER_ID = "onboarding.side-panels.activity.renderer";
const ACTIVITY_TAB_RENDERER_ID = "onboarding.side-panels.activity.tab";
const ACTIVITY_TAB_MENU_RENDERER_ID = "onboarding.side-panels.activity.tab-menu";
const PREVIEW_WIDGET_ID = "onboarding.side-panels.preview";
const PROBLEMS_WIDGET_ID = "onboarding.side-panels.problems";
const FILES_WIDGET_ID = "onboarding.side-panels.files";

const usePrimaryResource = (workbench: WorkbenchCore) =>
  useWorkbenchStore(workbench.layout.store, (state) => getAnchorResource(state.layout, "primary"));

const ActivityTab = () => (
  <HStack gap="2xs" minW="0">
    <WorkbenchIcon name="Activity" size={12} />
    <Text as="span">Activity</Text>
    <Badge size="sm" colorPalette="green">
      Live
    </Badge>
  </HStack>
);

const ActivityTabMenu = () => (
  <Menu.Item value="live" disabled asChild>
    <ListRow asChild variant="full-width" label="Live context" disabled />
  </Menu.Item>
);

const ResourcePicker = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const primaryResource = usePrimaryResource(workbench);

  return (
    <ScrollArea h="full" bg="bg.subtle" contentProps={{ p: "sm", display: "flex", flexDirection: "column", gap: "sm" }}>
      <Text textStyle="label/S/semibold" color="fg.muted">
        Resources
      </Text>
      <Stack gap="2xs">
        {sidePanelItems.map((item) => {
          const resource = sidePanelItemResource(item);
          const selected = resource.uri === primaryResource?.uri;

          return (
            <ListRow
              key={item.id}
              label={item.label}
              description={`${item.status} · ${item.owner}`}
              icon={<WorkbenchIcon name="FileText" size={16} />}
              isSelected={selected}
              onActivate={() => void workbench.resources.openResource(resource)}
            />
          );
        })}
      </Stack>
    </ScrollArea>
  );
};

const ResourceDetail = (props: { workbench: WorkbenchCore; resource: ResourceRef | undefined }) => {
  const { workbench, resource } = props;
  const item = findSidePanelItem(resource);

  return (
    <ScrollArea h="full" bg="bg" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "lg" }}>
      <Stack gap="xs" maxW="720px">
        <HStack gap="xs" wrap="wrap">
          <Badge colorPalette="blue">{item.status}</Badge>
          <Badge colorPalette="gray">{item.owner}</Badge>
        </HStack>
        <Text textStyle="title/M/semibold">{item.label}</Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          {item.summary}
        </Text>
        <Code colorPalette="gray" w="fit-content">
          {resource?.uri}
        </Code>
      </Stack>

      <Stack gap="sm" maxW="640px">
        <Text textStyle="label/S/semibold">Open another resource</Text>
        <HStack gap="sm" wrap="wrap">
          {sidePanelItems.map((candidate) => {
            const resourceRef = sidePanelItemResource(candidate);
            return (
              <Button
                key={candidate.id}
                size="sm"
                variant={candidate.id === item.id ? "primary" : "outline"}
                onClick={() => void workbench.resources.openResource(resourceRef)}
              >
                <WorkbenchIcon name="FileText" />
                {candidate.label}
              </Button>
            );
          })}
        </HStack>
      </Stack>
    </ScrollArea>
  );
};

const ResourceContextPanel = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const primaryResource = usePrimaryResource(workbench);
  const item = findSidePanelItem(primaryResource);

  return (
    <ScrollArea h="full" bg="bg" contentProps={{ p: "md", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="2xs">
        <Text textStyle="label/S/semibold" color="fg.muted">
          Resource context
        </Text>
        <Text textStyle="title/S/semibold">{item.label}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {item.summary}
        </Text>
      </Stack>

      <Stack gap="xs">
        <Text textStyle="label/S/semibold">Related files</Text>
        {item.files.map((file) => (
          <HStack key={file} gap="xs" minW="0">
            <WorkbenchIcon name="FileText" size={14} />
            <Text textStyle="paragraph/S/regular" minW="0" truncate>
              {file}
            </Text>
          </HStack>
        ))}
      </Stack>

      <Stack gap="xs">
        <Text textStyle="label/S/semibold">Resource activity</Text>
        {item.activity.map((entry) => (
          <HStack key={entry} gap="xs" align="flex-start">
            <WorkbenchIcon name="RefreshCw" size={14} />
            <Text textStyle="paragraph/S/regular">{entry}</Text>
          </HStack>
        ))}
      </Stack>
    </ScrollArea>
  );
};

export const createSidePanelsModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.side-panels",
  activate(ctx) {
    ctx.resources.registerKind({
      kind: SIDE_PANEL_ITEM_KIND,
      label: "Onboarding item",
      icon: "FileText",
      surface: "primary",
    });
    ctx.resources.registerOpener({
      id: "onboarding.side-panels.item-opener",
      canOpen: (resource) => resource.kind === SIDE_PANEL_ITEM_KIND,
      open: (resource, input) => {
        ctx.breadcrumbs.setItems([{ title: resource.label ?? "Resource", icon: resource.icon, resource }]);
        return ctx.layout.openWidget(DETAIL_WIDGET_ID, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        });
      },
    });

    ctx.renderers.registerRenderer({
      id: RESOURCE_PICKER_RENDERER_ID,
      render: ({ workbench }) => <ResourcePicker workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({
      id: CONTEXT_RENDERER_ID,
      render: ({ workbench }) => <ResourceContextPanel workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({
      id: DETAIL_RENDERER_ID,
      render: ({ workbench, placement }) => <ResourceDetail workbench={workbench} resource={placement.resource} />,
    });
    ctx.renderers.registerRenderer({
      id: INSPECTOR_RENDERER_ID,
      render: ({ workbench }) => <ResourceInspector workbench={workbench} detailWidgetId={DETAIL_WIDGET_ID} />,
    });
    ctx.renderers.registerRenderer({
      id: ACTIVITY_RENDERER_ID,
      render: ({ workbench }) => <ResourceActivityPanel workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({ id: ACTIVITY_TAB_RENDERER_ID, render: () => <ActivityTab /> });
    ctx.renderers.registerRenderer({ id: ACTIVITY_TAB_MENU_RENDERER_ID, render: () => <ActivityTabMenu /> });

    ctx.layout.registerWidget({
      id: RESOURCE_PICKER_WIDGET_ID,
      title: "Resources",
      region: "sidebar",
      regionSize: { defaultPx: 220, minPx: 180 },
      singleton: true,
      rendererId: RESOURCE_PICKER_RENDERER_ID,
    });
    registerSidePanelMenuExamples(ctx);
    ctx.layout.registerLocation({
      id: DETAIL_WIDGET_ID,
      title: "Resource",
      region: "main",
      singleton: false,
      resourceKinds: [SIDE_PANEL_ITEM_KIND],
      rendererId: DETAIL_RENDERER_ID,
      panelMenus: [
        {
          id: CONTEXT_WIDGET_ID,
          title: "Context",
          icon: "ListTree",
          side: "left",
          regionSize: { defaultPx: 240, minPx: 200 },
          singleton: true,
          rendererId: CONTEXT_RENDERER_ID,
        },
        ...sidePanelMenuDefinitions.location,
      ],
    });
    ctx.layout.registerSubPanel({
      id: INSPECTOR_WIDGET_ID,
      title: "Inspector",
      region: "side",
      regionSize: { defaultPx: 420, minPx: 320 },
      singleton: true,
      rendererId: INSPECTOR_RENDERER_ID,
      panelMenus: sidePanelMenuDefinitions.inspector,
    });
    ctx.layout.registerSubPanel({
      id: ACTIVITY_WIDGET_ID,
      title: "Activity",
      region: "secondary",
      regionSize: { defaultPx: 180, minPx: 128, maxPx: 320 },
      singleton: true,
      rendererId: ACTIVITY_RENDERER_ID,
      panelMenus: sidePanelMenuDefinitions.activity,
      tab: {
        contentRendererId: ACTIVITY_TAB_RENDERER_ID,
        contextMenuRendererId: ACTIVITY_TAB_MENU_RENDERER_ID,
      },
    });
    ctx.layout.registerSubPanel({
      id: PREVIEW_WIDGET_ID,
      title: "Preview",
      icon: "Eye",
      region: "main",
      resourceKinds: [SIDE_PANEL_ITEM_KIND],
      rendererId: DETAIL_RENDERER_ID,
    });
    ctx.layout.registerSubPanel({
      id: PROBLEMS_WIDGET_ID,
      title: "Problems",
      icon: "CircleAlert",
      region: "secondary",
      rendererId: ACTIVITY_RENDERER_ID,
    });
    ctx.layout.registerSubPanel({
      id: FILES_WIDGET_ID,
      title: "Files",
      icon: "Folder",
      region: "side",
      rendererId: CONTEXT_RENDERER_ID,
    });

    // Context demonstrates a Main Panel menu while Inspector demonstrates the independent
    // Side Panel. Their logical identities do not depend on their rendered edges.
    ctx.layout.openWidget(RESOURCE_PICKER_WIDGET_ID, { pinned: true });
    void ctx.resources.openResource(sidePanelItemResource(sidePanelItems[0])).then(() => {
      ctx.layout.openWidget(INSPECTOR_WIDGET_ID, { pinned: true });
      ctx.layout.openWidget(ACTIVITY_WIDGET_ID, { pinned: true });
    });
  },
});
