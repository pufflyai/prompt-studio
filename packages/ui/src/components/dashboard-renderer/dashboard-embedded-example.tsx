import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { defineChart, lineY, ruleX } from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { useRef, useState } from "react";
import { Chart, chartColor } from "@/components/charts/chart";
import { ScopedPopover as Popover } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { DashboardRenderer } from "./dashboard-renderer";
import type { DashboardDefinition } from "./dashboard-types";

const initial: DashboardDefinition = {
  mode: "vertical",
  widgets: [{ id: "releases", title: "", kind: "custom", source: "releases", layout: { x: 0, y: 0, w: 12, h: 8 } }],
};

function BuildHistory({ markerLabel = "Release marker" }: { markerLabel?: string }) {
  const [showMarker, setShowMarker] = useState(true);
  const data = [
    { day: 1, builds: 4 },
    { day: 2, builds: 9 },
    { day: 3, builds: 6 },
  ];
  const chart = defineChart({
    scales: { x: { scale: scaleLinear }, y: { scale: scaleLinear } },
    marks: [
      lineY(data, { x: "day", y: "builds", stroke: chartColor("vis.categorical.4") }),
      ...(showMarker
        ? [decorative(ruleX([2], { stroke: chartColor("vis.categorical.2"), strokeDasharray: "4 4" }))]
        : []),
    ],
  });
  return (
    <Box>
      <HStack>
        <Button size="xs" aria-pressed={showMarker} onClick={() => setShowMarker(!showMarker)}>
          {markerLabel}
        </Button>
        <Popover.Root closeOnInteractOutside={false} positioning={{ strategy: "fixed" }}>
          <Popover.Trigger asChild>
            <Button size="xs">{markerLabel} options</Button>
          </Popover.Trigger>
          <Portal>
            <Popover.Positioner>
              <Popover.Content aria-label={`${markerLabel} options`}>
                <Popover.Body>
                  <Button size="xs" onClick={() => setShowMarker(!showMarker)}>
                    Toggle {markerLabel.toLowerCase()}
                  </Button>
                </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      </HStack>
      <Chart
        definition={chart}
        ariaLabel={showMarker ? `Build count with a ${markerLabel.toLowerCase()}` : "Build count"}
        height={220}
      />
    </Box>
  );
}

export function DashboardEmbeddedExample(props: { deferRefresh?: boolean }) {
  const { deferRefresh = false } = props;
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState<{ id: number; definition: DashboardDefinition }[]>([]);
  const [pendingSave, setPendingSave] = useState<{ complete: () => void; publishCorrection: () => void } | null>(null);
  const nextSaveId = useRef(1);
  const latestSave = saved.at(-1);
  const publishSave = (id: number, definition: DashboardDefinition) => {
    setValue(definition);
    setSaved((previous) => previous.filter((save) => save.id !== id));
  };
  return (
    <DashboardRenderer
      value={value}
      onChange={async (next) => {
        if (deferRefresh) {
          let savedDefinition = next;
          await new Promise<void>((complete) =>
            setPendingSave({
              complete,
              publishCorrection: () => {
                savedDefinition = {
                  ...next,
                  widgets: next.widgets.map((widget) => ({ ...widget, title: widget.title.toUpperCase() })),
                };
                setValue(savedDefinition);
              },
            }),
          );
          setPendingSave(null);
          const id = nextSaveId.current++;
          setSaved((previous) => [...previous, { id, definition: savedDefinition }]);
          // The caller can republish its previous layout before the saved change is available.
          setValue((current) => ({ ...current, widgets: [...current.widgets] }));
        } else {
          setValue(next);
        }
      }}
      sources={[
        {
          id: "releases",
          name: "Build history",
          metric: { value: 7 },
          content: <BuildHistory />,
        },
        {
          id: "deployments",
          name: "Deployment history",
          content: <BuildHistory markerLabel="Deployment marker" />,
        },
      ]}
      renderToolbar={(controls) => (
        <HStack
          role="toolbar"
          aria-label="Build history controls"
          justify="space-between"
          flexWrap="wrap"
          p="md"
          borderBottomWidth="1px"
          borderColor="border.subtle"
        >
          <Text as="h1" textStyle="heading/S">
            Build history
          </Text>
          {controls}
          {pendingSave && (
            <>
              <Button onClick={() => pendingSave.publishCorrection()}>Publish corrected dashboard</Button>
              <Button onClick={() => pendingSave.complete()}>Complete save</Button>
            </>
          )}
          {saved.slice(0, -1).map(({ id, definition }) => (
            <Button key={id} onClick={() => publishSave(id, definition)}>
              Publish save {id}
            </Button>
          ))}
          {latestSave && (
            <Button onClick={() => publishSave(latestSave.id, latestSave.definition)}>Refresh saved dashboard</Button>
          )}
        </HStack>
      )}
    />
  );
}
