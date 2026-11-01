import { Button, Fieldset, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { AlertMessage, Checkbox, SegmentedControl, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";

const STATES = [
  { value: "new", label: "New run" },
  { value: "running", label: "Running" },
  { value: "finished", label: "Finished" },
  { value: "cancelled", label: "Cancelled" },
  { value: "results", label: "View results" },
  { value: "single", label: "One commit" },
  { value: "separate", label: "Separate runs" },
  { value: "missing", label: "Missing comparison" },
  { value: "sync", label: "Sync failed" },
  { value: "release", label: "Release pending" },
];

const SUITES = [
  "Desktop app",
  "Workbench interactions",
  "Canvas cold startup",
  "Chat rendering",
  "Side navigation",
  "Planner board",
  "Storage",
  "Runtime",
  "Relay storage",
];

const PLATFORMS = ["Linux x64", "macOS arm64", "macOS x64", "Windows x64"];

const OTHER_RUNS = [
  { id: "1043", source: "Release 0.46.0", status: "Running" },
  { id: "1040", source: "Started by an agent", status: "Finished" },
  { id: "1031", source: "Started on GitHub", status: "Finished" },
];

const MEASUREMENTS = [
  { label: "Session badge query", base: "9.4 ms", head: "9.1 ms", change: "−3%", budget: "Below 100 ms" },
  { label: "Record save", base: "1.1 ms", head: "1.2 ms", change: "+9%", budget: "No budget" },
];

const toggle = (list: string[], item: string) =>
  list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

interface CommitProps {
  base: string;
  head: string;
  onBase: (value: string) => void;
  onHead: (value: string) => void;
}

interface NewRunCardProps extends CommitProps {
  suites: string[];
  platforms: string[];
  onSuites: (suites: string[]) => void;
  onPlatforms: (platforms: string[]) => void;
  onStart: () => void;
}

const runnableSuites = (suites: string[], platforms: string[]) =>
  suites.filter((suite) => suite !== "Relay storage" || platforms.includes("Linux x64"));

const NewRunCard = (props: NewRunCardProps) => {
  const { base, head, onBase, onHead, onStart, suites, platforms, onSuites, onPlatforms } = props;
  // Relay needs Linux and Docker, so it can only be chosen with Linux x64 and skips every other platform.
  const relayAllowed = platforms.includes("Linux x64");
  const chosen = runnableSuites(suites, platforms);
  const relaySkips = chosen.includes("Relay storage") ? platforms.filter((platform) => platform !== "Linux x64") : [];
  const jobs = chosen.length * platforms.length - relaySkips.length;
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="md">
          <Text textStyle="heading/S">New benchmark run</Text>
          <HStack gap="md" wrap="wrap">
            <Stack flex="1" gap="xs">
              <Text textStyle="label/S/medium">Base</Text>
              <Input aria-label="Base commit" value={base} onChange={(event) => onBase(event.target.value)} />
            </Stack>
            <Stack flex="1" gap="xs">
              <Text textStyle="label/S/medium">Head</Text>
              <Input aria-label="Head commit" value={head} onChange={(event) => onHead(event.target.value)} />
            </Stack>
          </HStack>
          <Fieldset.Root>
            <Fieldset.Legend textStyle="label/S/regular" color="fg.muted">
              Suites
            </Fieldset.Legend>
            <Stack gap="xs" pt="xs">
              {SUITES.map((suite) => {
                const disabled = suite === "Relay storage" && !relayAllowed;
                return (
                  <Checkbox
                    key={suite}
                    disabled={disabled}
                    checked={!disabled && suites.includes(suite)}
                    onCheckedChange={() => onSuites(toggle(suites, suite))}
                  >
                    {suite}
                    {disabled ? " · Needs Linux x64 and Docker" : ""}
                  </Checkbox>
                );
              })}
            </Stack>
          </Fieldset.Root>
          <Fieldset.Root>
            <Fieldset.Legend textStyle="label/S/regular" color="fg.muted">
              Platforms
            </Fieldset.Legend>
            <HStack gap="md" wrap="wrap" pt="xs">
              {PLATFORMS.map((platform) => (
                <Checkbox
                  key={platform}
                  checked={platforms.includes(platform)}
                  onCheckedChange={() => onPlatforms(toggle(platforms, platform))}
                >
                  {platform}
                </Checkbox>
              ))}
            </HStack>
          </Fieldset.Root>
          {relaySkips.length ? (
            <Text textStyle="label/S/regular" color="fg.muted">
              Relay storage runs on Linux x64 only. It skips {relaySkips.join(", ")}.
            </Text>
          ) : null}
          <Text textStyle="label/S/regular">{jobs} jobs · Each benchmark runs once</Text>
          <Button size="sm" variant="primary" disabled={!jobs} onClick={onStart}>
            Start run
          </Button>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

interface CompareCardProps extends CommitProps {
  screen: string;
  onRun: () => void;
  platforms: string[];
}

const CompareCard = (props: CompareCardProps) => {
  const { screen, base, head, onBase, onHead, onRun, platforms } = props;
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="md">
          <Text textStyle="heading/S">Compare commits · {platforms.join(", ")}</Text>
          <HStack gap="md" wrap="wrap">
            <Stack flex="1" gap="xs">
              <Text textStyle="label/S/medium">Base</Text>
              <Input
                aria-label="Base commit"
                placeholder="Choose a base commit"
                value={base}
                onChange={(event) => onBase(event.target.value)}
              />
            </Stack>
            <Stack flex="1" gap="xs">
              <Text textStyle="label/S/medium">Head</Text>
              <Input aria-label="Head commit" value={head} onChange={(event) => onHead(event.target.value)} />
            </Stack>
          </HStack>
          {screen === "missing" ? (
            <Stack gap="sm">
              <Text textStyle="label/S/regular" color="fg.muted">
                These commits have no results on {platforms.join(", ")}.
              </Text>
              <Button size="sm" variant="primary" onClick={onRun}>
                Run benchmarks for both commits
              </Button>
            </Stack>
          ) : (
            <Stack gap="sm">
              <Text textStyle="label/S/regular" color="fg.muted">
                {screen === "separate" ? "Base from run 1031 · Head from run 1044" : "From run 1044"}
              </Text>
              {screen === "separate" ? (
                <AlertMessage status="warning" title="Separate runs">
                  <Stack gap="sm">
                    <Text>These commits were measured on different runners at different times.</Text>
                    <Button size="sm" variant="outline" onClick={onRun}>
                      Measure both together
                    </Button>
                  </Stack>
                </AlertMessage>
              ) : null}
              {MEASUREMENTS.map((metric) => (
                <HStack key={metric.label} justify="space-between" wrap="wrap" gap="md">
                  <Text textStyle="label/S/regular">{metric.label}</Text>
                  <Text textStyle="mono/XS">
                    {screen === "single"
                      ? `${metric.head} · ${metric.budget}`
                      : `${metric.base} → ${metric.head} · ${metric.change} · ${metric.budget}`}
                  </Text>
                </HStack>
              ))}
              <Text textStyle="label/S/regular" color="fg.muted">
                1 sample per metric. Not enough evidence for a confidence interval or an improved or regressed verdict.
              </Text>
            </Stack>
          )}
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

const FinishBenchmarkFlow = () => {
  const [screen, setScreen] = useState("new");
  const [base, setBase] = useState("main~1");
  const [head, setHead] = useState("main");
  const [suites, setSuites] = useState(["Storage", "Runtime"]);
  const [platforms, setPlatforms] = useState(["Linux x64"]);
  const [notice, setNotice] = useState("");
  const show = (next: string, message = "") => {
    if (next === "single") setBase("");
    setScreen(next);
    setNotice(message);
  };

  const compare = screen === "results" || screen === "single" || screen === "separate" || screen === "missing";
  const chosen = runnableSuites(suites, platforms);
  const cancelledSuite = chosen.at(-1) ?? "Benchmark";
  const completedSuites = chosen.slice(0, -1);

  return (
    <Stack gap="lg" p="lg">
      <Text textStyle="heading/M">Performance</Text>
      <SegmentedControl
        aria-label="Proposed benchmark flow state"
        value={screen}
        options={STATES}
        onValueChange={(value) => show(value)}
      />
      {screen === "sync" ? (
        <AlertMessage status="error" title="Results could not be synced">
          <Stack gap="sm">
            <Text>GitHub is unavailable. Showing results last synced on 1 November at 09:42.</Text>
            <Button size="sm" variant="outline" onClick={() => show("finished", "Synced. Run 1044 is up to date.")}>
              Retry sync
            </Button>
          </Stack>
        </AlertMessage>
      ) : null}
      {screen === "new" ? (
        <NewRunCard
          base={base}
          head={head}
          onBase={setBase}
          onHead={setHead}
          suites={suites}
          platforms={platforms}
          onSuites={setSuites}
          onPlatforms={setPlatforms}
          onStart={() => show("running")}
        />
      ) : null}
      {screen === "running" ? (
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="md">
              <Text textStyle="heading/S">Run 1044 · Running</Text>
              <Text textStyle="mono/XS">
                {base} → {head} · {platforms.join(", ")} · Started here
              </Text>
              <Text textStyle="label/S/regular">
                {chosen
                  .map((suite, index) => `${suite} ${index < chosen.length - 1 ? "finished" : "running"}`)
                  .join(" · ")}
                {" · Elapsed 4 min"}
              </Text>
              <HStack gap="sm">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => show("cancelled", "Run 1044 cancelled. Completed results are kept.")}
                >
                  Cancel run
                </Button>
                <Button size="sm" variant="ghost" onClick={() => show("finished")}>
                  Preview completion
                </Button>
              </HStack>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      ) : null}
      {screen === "finished" || screen === "cancelled" || screen === "sync" ? (
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="md">
              <HStack justify="space-between" wrap="wrap" gap="sm">
                <Text textStyle="heading/S">Run 1044 · {screen === "cancelled" ? "Cancelled" : "Finished"}</Text>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={screen === "cancelled" && completedSuites.length === 0}
                  onClick={() => show("results")}
                >
                  View results
                </Button>
              </HStack>
              <Text textStyle="mono/XS">
                {base} → {head} · {platforms.join(", ")} · Elapsed 6 min
              </Text>
              <Text textStyle="label/S/regular">{chosen.join(" · ")}</Text>
              {screen === "cancelled" ? (
                <AlertMessage status="warning" title={`${cancelledSuite} was cancelled`}>
                  {completedSuites.length ? `${completedSuites.join(", ")} finished and has results. ` : ""}
                  {cancelledSuite} stopped mid-run and has no measurements.
                </AlertMessage>
              ) : null}
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      ) : null}
      {screen === "running" || screen === "finished" ? (
        <Stack gap="xs">
          <Text textStyle="label/S/medium">Other runs in this repository</Text>
          {OTHER_RUNS.map((run) => (
            <HStack key={run.id} justify="space-between" wrap="wrap" gap="md">
              <Text textStyle="label/S/regular">
                Run {run.id} · {run.source}
              </Text>
              <Text textStyle="label/S/regular" color="fg.muted">
                {run.status}
              </Text>
            </HStack>
          ))}
        </Stack>
      ) : null}
      {compare ? (
        <CompareCard
          screen={screen}
          base={base}
          head={head}
          onBase={(value) => {
            setBase(value);
            if (screen === "single" && value.trim()) setScreen("results");
          }}
          onHead={setHead}
          onRun={() => show("new")}
          platforms={platforms}
        />
      ) : null}
      {screen === "release" ? (
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="md">
              <Text textStyle="heading/S">Release trends</Text>
              <Text textStyle="label/S/regular">0.46.0 · Benchmark results pending</Text>
              <Text textStyle="label/S/regular" color="fg.muted">
                Release 0.45.0 has no benchmark results. Missing measurements are not shown as zero.
              </Text>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setNotice("Checking release results. The cached history remains available.")}
              >
                Refresh results
              </Button>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      ) : null}
      {notice ? (
        <Text role="status" textStyle="label/S/regular">
          {notice}
        </Text>
      ) : null}
    </Stack>
  );
};

const meta: CanvasMeta<typeof FinishBenchmarkFlow> = {
  title: "Extensions/Prompt Studio Dev/Benchmark runs",
  component: FinishBenchmarkFlow,
  fullscreen: true,
};
export default meta;

export const ProposedCompleteFlow: CanvasFrame<typeof FinishBenchmarkFlow> = {
  id: "extensions-prompt-studio-dev-benchmark-runs--proposed-complete-flow",
  name: "Proposed complete flow",
};
