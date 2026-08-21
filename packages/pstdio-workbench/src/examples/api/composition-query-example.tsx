import { Badge, Code, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { createWorkbenchCore, type WorkbenchCore, type WorkbenchPanelRegion } from "../../core";
import { useWorkbenchStore } from "../../react";
import { ApiWorkbenchFrame } from "./api-story-frame";

const queryRendererId = "api.composition.renderer";
export const compositionPanelIds = {
  artifacts: "api.composition.artifacts",
  inspector: "api.composition.inspector",
  overview: "api.composition.overview",
  timeline: "api.composition.timeline",
} as const;

const queryModeId = "api.composition.mode";
const panelRegions: WorkbenchPanelRegion[] = ["main", "secondary", "side"];
const queryCandidates = [
  { panelId: compositionPanelIds.artifacts, region: "main", allowedRegions: ["main"] },
  { panelId: compositionPanelIds.timeline, region: "secondary", allowedRegions: ["secondary", "side"] },
  { panelId: compositionPanelIds.inspector, region: "side", allowedRegions: ["side", "secondary"] },
] as const;

const isPanelOpen = (workbench: WorkbenchCore, panelId: string) =>
  Object.values(workbench.layout.getLayout().regions).some((region) =>
    region.widgets.some((placement) => placement.contributionId === panelId),
  );

const createCompositionQueryWorkbench = () => {
  const workbench = createWorkbenchCore();
  workbench.renderers.registerRenderer({
    id: queryRendererId,
    render: ({ instance }) => (
      <Stack gap="sm" p="lg">
        <Text textStyle="heading/M">{instance.title}</Text>
        <Text color="fg.muted">This content comes from a registered panel definition.</Text>
      </Stack>
    ),
  });
  for (const panel of [
    { id: compositionPanelIds.overview, title: "Overview", region: "main" },
    { id: compositionPanelIds.artifacts, title: "Artifacts", region: "main" },
    { id: compositionPanelIds.timeline, title: "Timeline", region: "secondary" },
    { id: compositionPanelIds.inspector, title: "Inspector", region: "side" },
  ] as const) {
    workbench.layout.registerPanel({ ...panel, rendererId: queryRendererId, singleton: true });
  }
  workbench.modes.registerMode({
    id: queryModeId,
    label: "API query",
    panels: panelRegions,
    activate: () => undefined,
    listAddablePanels: () => queryCandidates.filter((panel) => !isPanelOpen(workbench, panel.panelId)),
  });
  workbench.modes.setActiveMode(queryModeId);
  workbench.layout.openPanel(compositionPanelIds.overview, {
    region: "main",
    role: "location",
    closable: false,
    pinned: true,
  });
  workbench.layout.openPanel(compositionPanelIds.inspector, {
    region: "side",
    role: "sub-panel",
    closable: true,
    pinned: true,
  });
  workbench.shell.setSidePanelPresentation("attached");
  return workbench;
};

interface ApiResultGroupProps {
  label: string;
  testId: string;
  values: readonly string[];
}

const ApiResultGroup = (props: ApiResultGroupProps) => {
  const { label, testId, values } = props;
  return (
    <Stack gap="xs">
      <Text color="fg.muted" textStyle="label/S">
        {label}
      </Text>
      <HStack data-testid={testId} gap="xs" minH="24px" wrap="wrap">
        {values.length === 0 ? <Text color="fg.subtle">none</Text> : null}
        {values.map((value) => (
          <Badge key={value} colorPalette="blue" variant="subtle">
            {value}
          </Badge>
        ))}
      </HStack>
    </Stack>
  );
};

const CompositionQueryInspector = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const openPanelCount = Object.values(layout.regions).reduce((total, region) => total + region.widgets.length, 0);

  return (
    <Grid data-open-panel-count={openPanelCount} gap="sm" templateColumns="repeat(3, minmax(0, 1fr))">
      {panelRegions.map((region) => {
        const result = workbench.composition.panelsFor(region);
        return (
          <Stack key={region} bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" gap="sm" p="md">
            <Code colorPalette="gray">composition.panelsFor(&quot;{region}&quot;)</Code>
            <ApiResultGroup
              label="open"
              testId={`${region}-open`}
              values={result.open.map((panel) => panel.contributionId)}
            />
            <ApiResultGroup
              label="addable"
              testId={`${region}-addable`}
              values={result.addable.map((panel) => panel.panelId)}
            />
            <ApiResultGroup label="closable" testId={`${region}-closable`} values={result.closable} />
          </Stack>
        );
      })}
    </Grid>
  );
};

export const CompositionQueryExample = () => {
  const [workbench] = useState(createCompositionQueryWorkbench);
  return (
    <ApiWorkbenchFrame workbench={workbench}>
      <CompositionQueryInspector workbench={workbench} />
    </ApiWorkbenchFrame>
  );
};
