import { Badge, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { createWorkbenchCore, type ResourceRef, type WorkbenchCore, type WorkbenchPanelInstance } from "../../core";
import { useWorkbenchStore } from "../../react";
import { ApiWorkbenchFrame } from "./api-story-frame";

export const panelTabIds = {
  duplicate: "api.tabs.duplicate",
  resource: "api.tabs.resource",
  singleton: "api.tabs.singleton",
} as const;

const rendererId = "api.tabs.renderer";

const registerRenderer = (workbench: WorkbenchCore) => {
  workbench.renderers.registerRenderer({
    id: rendererId,
    render: ({ instance }) => (
      <Stack gap="sm" p="lg">
        <Text textStyle="heading/M">{instance.title}</Text>
        <Text color="fg.muted">Panel instance</Text>
        <Code alignSelf="flex-start" colorPalette="gray">
          {instance.instanceId}
        </Code>
      </Stack>
    ),
  });
};

const openPersistentPanel = (
  workbench: WorkbenchCore,
  panelId: string,
  input: { resource?: ResourceRef; title: string },
) =>
  workbench.layout.openPanel(panelId, {
    ...input,
    role: "sub-panel",
    strategy: { kind: "persistent" },
  });

const showSecondaryPanel = (workbench: WorkbenchCore) => {
  workbench.layout.setRegionVisible("secondary", true);
  workbench.panels.setOpen("secondary", true);
};

interface PanelInstanceSummaryProps {
  panelId: string;
  testId: string;
  workbench: WorkbenchCore;
}

const PanelInstanceSummary = (props: PanelInstanceSummaryProps) => {
  const { panelId, testId, workbench } = props;
  const widgets = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.secondary.widgets);
  const placements = widgets.filter((placement) => placement.contributionId === panelId);

  return (
    <HStack justify="space-between" gap="md" wrap="wrap">
      <Text>
        Instances: <Code data-testid={`${testId}-count`}>{placements.length}</Code>
      </Text>
      <HStack data-testid={`${testId}-instances`} gap="xs" wrap="wrap">
        {placements.map((placement) => (
          <Badge key={placement.widgetId} colorPalette="blue" variant="subtle">
            {placement.widgetId}
          </Badge>
        ))}
      </HStack>
    </HStack>
  );
};

const createSingletonWorkbench = () => {
  const workbench = createWorkbenchCore();
  registerRenderer(workbench);
  workbench.layout.registerPanel({
    id: panelTabIds.singleton,
    title: "Outline",
    region: "secondary",
    singleton: true,
    eligibleLocations: {},
    rendererId,
  });
  const instance = openPersistentPanel(workbench, panelTabIds.singleton, { title: "Outline" });
  showSecondaryPanel(workbench);
  return { instance, workbench };
};

export const SingletonPanelExample = () => {
  const [setup] = useState(createSingletonWorkbench);
  const [lastInstance, setLastInstance] = useState<WorkbenchPanelInstance>(setup.instance);

  return (
    <ApiWorkbenchFrame workbench={setup.workbench}>
      <HStack justify="space-between" gap="md" wrap="wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setLastInstance(openPersistentPanel(setup.workbench, panelTabIds.singleton, { title: "Outline" }))
          }
        >
          Open singleton again
        </Button>
        <Text>
          Returned instance: <Code data-testid="singleton-returned-id">{lastInstance.instanceId}</Code>
        </Text>
      </HStack>
      <PanelInstanceSummary workbench={setup.workbench} panelId={panelTabIds.singleton} testId="singleton" />
    </ApiWorkbenchFrame>
  );
};

const documents = {
  alpha: { kind: "document", uri: "document:alpha", id: "alpha", label: "Alpha.md" },
  beta: { kind: "document", uri: "document:beta", id: "beta", label: "Beta.md" },
} as const satisfies Record<string, ResourceRef>;

const openDocument = (workbench: WorkbenchCore, resource: ResourceRef) =>
  openPersistentPanel(workbench, panelTabIds.resource, { resource, title: resource.label ?? resource.uri });

const createResourceTabsWorkbench = () => {
  const workbench = createWorkbenchCore();
  registerRenderer(workbench);
  workbench.layout.registerPanel({
    id: panelTabIds.resource,
    title: "Document",
    region: "secondary",
    singleton: false,
    reuse: "resource",
    resourceKinds: ["document"],
    eligibleLocations: {},
    rendererId,
  });
  openDocument(workbench, documents.alpha);
  openDocument(workbench, documents.beta);
  showSecondaryPanel(workbench);
  return workbench;
};

export const ResourceTabsExample = () => {
  const [workbench] = useState(createResourceTabsWorkbench);

  return (
    <ApiWorkbenchFrame workbench={workbench}>
      <HStack gap="sm" wrap="wrap">
        <Button size="sm" variant="outline" onClick={() => openDocument(workbench, documents.alpha)}>
          Reopen Alpha
        </Button>
        <Button size="sm" variant="outline" onClick={() => openDocument(workbench, documents.beta)}>
          Reopen Beta
        </Button>
      </HStack>
      <PanelInstanceSummary workbench={workbench} panelId={panelTabIds.resource} testId="resource" />
    </ApiWorkbenchFrame>
  );
};

const createDuplicateTabsWorkbench = () => {
  const workbench = createWorkbenchCore();
  registerRenderer(workbench);
  workbench.layout.registerPanel({
    id: panelTabIds.duplicate,
    title: "Scratch",
    region: "secondary",
    singleton: false,
    reuse: "none",
    eligibleLocations: {},
    rendererId,
  });
  openPersistentPanel(workbench, panelTabIds.duplicate, { title: "Scratch 1" });
  openPersistentPanel(workbench, panelTabIds.duplicate, { title: "Scratch 2" });
  showSecondaryPanel(workbench);
  return workbench;
};

export const DuplicateTabsExample = () => {
  const [workbench] = useState(createDuplicateTabsWorkbench);
  const widgets = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.secondary.widgets);
  const placements = widgets.filter((placement) => placement.contributionId === panelTabIds.duplicate);

  return (
    <ApiWorkbenchFrame workbench={workbench}>
      <Button
        alignSelf="flex-start"
        size="sm"
        variant="outline"
        onClick={() =>
          openPersistentPanel(workbench, panelTabIds.duplicate, { title: `Scratch ${placements.length + 1}` })
        }
      >
        New scratch tab
      </Button>
      <PanelInstanceSummary workbench={workbench} panelId={panelTabIds.duplicate} testId="duplicate" />
    </ApiWorkbenchFrame>
  );
};
