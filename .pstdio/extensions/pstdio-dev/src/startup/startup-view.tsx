import { Badge, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, EmptyState } from "@pstdio/ui";
import { DataTable, type RowData } from "@pstdio/ui/data-table";
import { useState } from "react";
import type { Launch } from "../diagnostics/timeline";
import { PageFrame } from "../webview/page-frame";
import { StartupChart, slowestSetup } from "./startup-chart";
import { formatMs, SetupWaterfall, StartupWaterfall } from "./waterfall";

export interface StartupViewProps {
  launches: Launch[];
  projectNames: Record<string, string>;
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

const LaunchDetail = (props: { launch: Launch; projectNames: Record<string, string> }) => {
  const { launch, projectNames } = props;
  const firstSetup = launch.setups[0];
  const waited =
    firstSetup && launch.readyMs !== null
      ? Date.parse(firstSetup.startedAt) - (Date.parse(launch.startedAt) + launch.readyMs)
      : null;
  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text textStyle="label/M/medium">Runtime startup · {formatMs(launch.readyMs)} to ready</Text>
        {launch.startup.length ? (
          <StartupWaterfall steps={launch.startup} />
        ) : (
          <Text textStyle="label/S/regular" color="fg.muted">
            This launch logged no startup steps.
          </Text>
        )}
      </Stack>
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
  const { launches, projectNames, logPath, error, loading, onRefresh } = props;
  const [chosen, setChosen] = useState<string>();
  const selected = launches.find((launch) => launch.id === chosen) ?? launches[0];
  return (
    <PageFrame
      toolbar={
        <HStack w="full" justify="space-between">
          <Text textStyle="label/S/regular" color="fg.muted" truncate>
            {logPath ? `From ${logPath}` : "Runtime startup and project setup timings"}
          </Text>
          <Button size="xs" variant="outline" loading={loading} onClick={onRefresh}>
            Refresh
          </Button>
        </HStack>
      }
    >
      {error ? (
        <AlertMessage status="error" title="Could not read the runtime log">
          {error}
        </AlertMessage>
      ) : null}
      {launches.length ? (
        <>
          <StartupChart launches={launches} onChoose={setChosen} />
          <LaunchTable launches={launches} selected={selected} onChoose={setChosen} />
          {selected ? <LaunchDetail launch={selected} projectNames={projectNames} /> : null}
        </>
      ) : (
        <EmptyState
          title={loading ? "Reading the runtime log" : "No launches logged yet"}
          description="Startup and project setup steps appear here after the runtime logs them."
        />
      )}
    </PageFrame>
  );
};
