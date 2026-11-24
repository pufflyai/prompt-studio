import { Badge, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, EmptyState } from "@pstdio/ui";
import { DataTable, type RowData } from "@pstdio/ui/data-table";
import { CalendarDays, Layers } from "lucide-react";
import { useState } from "react";
import type { Launch } from "../diagnostics/timeline";
import { PageFrame } from "../webview/page-frame";
import { type Aggregation, aggregationOptions, type DateRange, rangeOptions } from "../webview/period";
import { SelectMenu } from "../webview/select-menu";
import { StartupChart } from "./startup-chart";
import { buildStartupTimeline, slowestSetup } from "./startup-timeline";
import { formatMs, SetupWaterfall, StartupWaterfall } from "./waterfall";

export interface StartupViewProps {
  launches: Launch[];
  projectNames: Record<string, string>;
  today: string;
  logPath?: string;
  error?: string;
  loading: boolean;
  onRefresh: () => void;
}

const ENDED_LABEL: Record<Launch["ended"], string> = { quit: "Quit", unknown: "No clean shutdown", running: "Running" };
const OUTCOME_COLOR = { completed: "green", failed: "red", interrupted: "orange", running: "gray" } as const;

const LaunchTable = (props: { launches: Launch[]; selected?: Launch; onChoose: (id: string) => void }) => {
  const { launches, selected, onChoose } = props;
  const rows: RowData[] = launches.map((launch) => ({
    id: launch.id,
    launch: new Date(launch.startedAt).toLocaleString(),
    ready: formatMs(launch.readyMs),
    setups: launch.setups.length,
    slowest: formatMs(slowestSetup(launch)),
    ended: ENDED_LABEL[launch.ended],
  }));
  return (
    <DataTable
      data={rows}
      hiddenColumns={["id"]}
      getRowId={(row) => String(row.id)}
      initialPageSize={10}
      defaultSettings={{ rowNumbers: false }}
      compactHeaders={{
        launch: "Launch",
        ready: "Runtime ready",
        setups: "Project setups",
        slowest: "Slowest setup",
        ended: "Ended",
      }}
      activeRowId={selected?.id ?? null}
      enableRowActivation
      onRowClick={(row) => onChoose(String(row.id))}
      toolbarStorageKey="startup-timeline-launches"
      itemLabel="launch"
    />
  );
};

const RuntimeStartup = (props: { launch: Launch }) => {
  const { launch } = props;
  return (
    <Stack gap="xs">
      <HStack gap="xs" flexWrap="wrap">
        <Text textStyle="label/M/medium">Runtime startup breakdown</Text>
        <Text textStyle="label/S/regular" color="fg.muted">
          {new Date(launch.startedAt).toLocaleString()} · {formatMs(launch.readyMs)} to ready
        </Text>
      </HStack>
      {launch.startup.length ? (
        <StartupWaterfall steps={launch.startup} />
      ) : (
        <Text textStyle="label/S/regular" color="fg.muted">
          This launch logged no startup steps.
        </Text>
      )}
    </Stack>
  );
};

const ProjectSetups = (props: { launch: Launch; projectNames: Record<string, string> }) => {
  const { launch, projectNames } = props;
  if (!launch.setups.length) return null;
  const firstSetup = launch.setups[0];
  const waited =
    firstSetup && launch.readyMs !== null
      ? Date.parse(firstSetup.startedAt) - (Date.parse(launch.startedAt) + launch.readyMs)
      : null;
  return (
    <Stack gap="lg">
      <Text textStyle="label/M/medium">Project setups</Text>
      {waited !== null && waited > 0 ? (
        <Text textStyle="label/S/regular" color="fg.muted">
          {formatMs(waited)} between a ready runtime and the first project setup.
        </Text>
      ) : null}
      {launch.setups.map((setup, index) => (
        <Stack key={`${setup.projectId}-${setup.startedAt}-${index}`} gap="xs">
          <HStack gap="xs">
            <Text textStyle="label/M/medium">
              {projectNames[setup.projectId] ?? `Project ${setup.projectId.slice(0, 8)}`} setup ·{" "}
              {formatMs(setup.durationMs)}
            </Text>
            <Badge size="sm" colorPalette={OUTCOME_COLOR[setup.outcome]}>
              {setup.outcome}
            </Badge>
            <Text textStyle="label/S/regular" color="fg.muted">
              {new Date(setup.startedAt).toLocaleTimeString()}
            </Text>
          </HStack>
          <SetupWaterfall setup={setup} />
        </Stack>
      ))}
    </Stack>
  );
};

export const StartupView = (props: StartupViewProps) => {
  const { launches, projectNames, today, logPath, error, loading, onRefresh } = props;
  const [chosen, setChosen] = useState<string>();
  const [range, setRange] = useState<DateRange>("30");
  const [aggregation, setAggregation] = useState<Aggregation>("day");
  const { buckets, selectedLaunches } = buildStartupTimeline({ today, range, aggregation, launches });
  const selected = selectedLaunches.find((launch) => launch.id === chosen) ?? selectedLaunches.at(0);
  const empty = launches.length
    ? { title: "No launches in this range", description: "Choose a longer range to include earlier launches." }
    : {
        title: "No launches logged yet",
        description: "Startup and project setup steps appear here after the runtime logs them.",
      };
  const emptyTitle = loading && !launches.length ? "Reading the runtime log" : empty.title;
  return (
    <PageFrame
      headerPadding="xs"
      toolbar={
        <>
          <Text textStyle="label/S/regular" color="fg.muted" flex="1" minW="0" truncate title={logPath}>
            {logPath ? `From ${logPath}` : "Runtime startup and project setup timings"}
          </Text>
          <SelectMenu
            label="Range"
            icon={<CalendarDays />}
            value={range}
            options={rangeOptions}
            onValueChange={(value) => setRange(value as DateRange)}
          />
          <SelectMenu
            label="Aggregation"
            icon={<Layers />}
            value={aggregation}
            options={aggregationOptions}
            onValueChange={(value) => setAggregation(value as Aggregation)}
          />
          <Button size="xs" variant="ghost" loading={loading} onClick={onRefresh}>
            Refresh
          </Button>
        </>
      }
    >
      {error ? (
        <AlertMessage status="error" title="Could not read the runtime log">
          {error}
        </AlertMessage>
      ) : null}
      {selectedLaunches.length ? (
        <>
          <StartupChart buckets={buckets} aggregation={aggregation} onChoose={setChosen} />
          {selected ? <RuntimeStartup launch={selected} /> : null}
          <LaunchTable launches={selectedLaunches} selected={selected} onChoose={setChosen} />
          {selected ? <ProjectSetups launch={selected} projectNames={projectNames} /> : null}
        </>
      ) : (
        <EmptyState title={emptyTitle} description={empty.description} />
      )}
    </PageFrame>
  );
};
