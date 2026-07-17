import { Badge, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { ListRow, ScrollArea } from "@pstdio/ui";
import { getAnchorResource, type ResourceRef, type WorkbenchCore, type WorkbenchModuleContribution } from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";
import {
  ACTIVITY_CONTEXT_WIDGET_ID,
  ACTIVITY_PROPERTIES_WIDGET_ID,
  ACTIVITY_WIDGET_ID,
  CONTEXT_RENDERER_ID,
  CONTEXT_WIDGET_ID,
  DETAIL_RENDERER_ID,
  DETAIL_WIDGET_ID,
  INSPECTOR_CONTEXT_WIDGET_ID,
  INSPECTOR_PROPERTIES_WIDGET_ID,
  INSPECTOR_RENDERER_ID,
  INSPECTOR_WIDGET_ID,
  ITEM_KIND,
  PROPERTIES_WIDGET_ID,
  RESOURCE_PICKER_RENDERER_ID,
  RESOURCE_PICKER_WIDGET_ID,
  STATUS_WIDGET_ID,
  sidePanelWidgets,
} from "./side-panels-layout";

interface SidePanelItem {
  id: string;
  label: string;
  status: string;
  owner: string;
  summary: string;
  files: string[];
  activity: string[];
}

const items: SidePanelItem[] = [
  {
    id: "design-brief",
    label: "Design brief",
    status: "Draft",
    owner: "Product",
    summary: "Define the first-pass layout and panel responsibilities for the onboarding shell.",
    files: ["brief.md", "wireframes/workbench-panels.fig", "src/onboarding/outline.ts"],
    activity: ["Left outline refreshed", "Inspector picked up Product owner", "Primary resource changed"],
  },
  {
    id: "api-audit",
    label: "API audit",
    status: "Review",
    owner: "Platform",
    summary: "Check which extension APIs should read primary resource state instead of global active state.",
    files: ["api.md", "frame-queries.ts", "workbench-core.test.ts"],
    activity: ["Resource tree selection moved", "Inspector updated status", "Breadcrumbs were replaced"],
  },
  {
    id: "release-notes",
    label: "Release notes",
    status: "Ready",
    owner: "Docs",
    summary: "Document side-panel sync behavior for resource-backed workbench views.",
    files: ["release-notes.md", "onboarding/14-side-panels.docs.mdx"],
    activity: ["Docs owner assigned", "Related files re-scoped", "Primary resource changed"],
  },
];

const itemResource = (item: SidePanelItem): ResourceRef => ({
  kind: ITEM_KIND,
  uri: `${ITEM_KIND}:${item.id}`,
  id: item.id,
  label: item.label,
  icon: "FileText",
  metadata: { status: item.status, owner: item.owner },
});

const findItem = (resource: ResourceRef | undefined) => items.find((item) => item.id === resource?.id) ?? items[0]!;

const usePrimaryResource = (workbench: WorkbenchCore) =>
  useWorkbenchStore(workbench.layout.store, (state) => getAnchorResource(state.frame, state.layout, "primary"));

const ResourcePicker = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const primaryResource = usePrimaryResource(workbench);

  return (
    <ScrollArea h="full" bg="bg.subtle" contentProps={{ p: "sm", display: "flex", flexDirection: "column", gap: "sm" }}>
      <Text textStyle="label/S/semibold" color="fg.muted">
        Resources
      </Text>
      <Stack gap="2xs">
        {items.map((item) => {
          const resource = itemResource(item);
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
  const item = findItem(resource);

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
          {items.map((candidate) => {
            const resourceRef = itemResource(candidate);
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
  const item = findItem(primaryResource);

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

const ResourceInspector = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const primaryResource = usePrimaryResource(workbench);
  const item = findItem(primaryResource);
  const mainPlacements = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas.main?.widgets ?? []);
  const detailTabs = mainPlacements.filter((placement) => placement.contributionId === DETAIL_WIDGET_ID);

  return (
    <ScrollArea h="full" bg="bg.subtle" contentProps={{ p: "md", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="2xs">
        <Text textStyle="label/S/semibold" color="fg.muted">
          Inspector
        </Text>
        <Text textStyle="title/S/semibold">{item.label}</Text>
        <Code colorPalette="gray" whiteSpace="normal">
          {primaryResource?.uri}
        </Code>
      </Stack>

      <Stack gap="xs">
        <Text textStyle="label/S/semibold">Resource facts</Text>
        <HStack justify="space-between" gap="sm">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Status
          </Text>
          <Badge colorPalette="blue">{item.status}</Badge>
        </HStack>
        <HStack justify="space-between" gap="sm">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Owner
          </Text>
          <Text textStyle="paragraph/S/semibold">{item.owner}</Text>
        </HStack>
      </Stack>

      <Stack gap="xs">
        <Text textStyle="label/S/semibold">Open detail tabs</Text>
        {detailTabs.map((placement) => (
          <HStack key={placement.widgetId} gap="xs" minW="0">
            <WorkbenchIcon name="FileText" size={14} />
            <Text textStyle="paragraph/S/regular" minW="0" truncate>
              {placement.title ?? placement.resource?.label ?? placement.widgetId}
            </Text>
          </HStack>
        ))}
      </Stack>
    </ScrollArea>
  );
};

export const createSidePanelsModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.side-panels",
  activate(ctx) {
    ctx.resources.registerKind({ kind: ITEM_KIND, label: "Onboarding item", icon: "FileText", surface: "primary" });
    ctx.resources.registerOpener({
      id: "onboarding.side-panels.item-opener",
      canOpen: (resource) => resource.kind === ITEM_KIND,
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
      render: ({ workbench }) => <ResourceInspector workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({
      id: STATUS_WIDGET_ID,
      render: () => (
        <HStack h="full" w="full" px="sm" justify="space-between">
          <Text textStyle="label/XS/regular">Workbench ready</Text>
          <Text textStyle="label/XS/regular" color="fg.muted">
            Panel regions synchronized
          </Text>
        </HStack>
      ),
    });

    for (const widget of sidePanelWidgets) ctx.layout.registerWidget(widget);

    // These panels are companions of the primary anchor: the framework hides them
    // automatically when `main` has no resource, so the app opens them only once.
    ctx.layout.openWidget(RESOURCE_PICKER_WIDGET_ID, { pinned: true });
    ctx.layout.openWidget(CONTEXT_WIDGET_ID, { pinned: true });
    ctx.layout.openWidget(PROPERTIES_WIDGET_ID, { pinned: true });
    ctx.layout.openWidget(INSPECTOR_WIDGET_ID, { pinned: true, companionOfPrimary: true });
    ctx.layout.openWidget(INSPECTOR_CONTEXT_WIDGET_ID, { pinned: true, companionOfPrimary: true });
    ctx.layout.openWidget(INSPECTOR_PROPERTIES_WIDGET_ID, { pinned: true, companionOfPrimary: true });
    ctx.layout.openWidget(ACTIVITY_WIDGET_ID, { pinned: true });
    ctx.layout.openWidget(ACTIVITY_CONTEXT_WIDGET_ID, { pinned: true });
    ctx.layout.openWidget(ACTIVITY_PROPERTIES_WIDGET_ID, { pinned: true });
    ctx.layout.openWidget(STATUS_WIDGET_ID, { pinned: true });
    ctx.layout.setAreaPresentation("side", "docked");
    void ctx.resources.openResource(itemResource(items[0]!));
  },
});
