import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { AlertMessage, SegmentedControl, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";

const STATES = [
  { value: "new", label: "New run" },
  { value: "running", label: "Running" },
  { value: "results", label: "Results" },
  { value: "partial", label: "Partial results" },
  { value: "sync", label: "Sync failed" },
  { value: "compare", label: "Missing comparison" },
  { value: "release", label: "Release pending" },
];

const MEASUREMENTS = [
  { label: "Session badge query", value: "9.1 ms", budget: "100 ms", outcome: "Below budget" },
  { label: "Record save", value: "1.2 ms", budget: "No budget", outcome: "Measured" },
];

const FinishBenchmarkFlow = () => {
  const [screen, setScreen] = useState("new");
  const [base, setBase] = useState("main~1");
  const [head, setHead] = useState("main");
  const [notice, setNotice] = useState("");
  const results = screen === "results" || screen === "partial";
  return (
    <Stack gap="lg" p="lg">
      <Text textStyle="heading/M">Performance</Text>
      <SegmentedControl
        aria-label="Proposed benchmark flow state"
        value={screen}
        options={STATES}
        onValueChange={(value) => {
          setScreen(value);
          setNotice("");
        }}
      />
      {screen === "sync" ? (
        <AlertMessage status="error" title="Results could not be synced">
          <Stack gap="sm">
            <Text>GitHub is unavailable. Showing results last synced on 1 November at 09:42.</Text>
            <Button size="sm" variant="outline" onClick={() => setScreen("results")}>
              Retry sync
            </Button>
          </Stack>
        </AlertMessage>
      ) : null}
      {screen === "new" || screen === "compare" ? (
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="md">
              <Text textStyle="heading/S">{screen === "compare" ? "Compare commits" : "New benchmark run"}</Text>
              <HStack gap="md" wrap="wrap">
                <Stack flex="1" gap="xs">
                  <Text textStyle="label/S/medium">Base</Text>
                  <Input aria-label="Base commit" value={base} onChange={(event) => setBase(event.target.value)} />
                </Stack>
                <Stack flex="1" gap="xs">
                  <Text textStyle="label/S/medium">Head</Text>
                  <Input aria-label="Head commit" value={head} onChange={(event) => setHead(event.target.value)} />
                </Stack>
              </HStack>
              <Text textStyle="label/S/regular">Storage and runtime · Linux x64 · One measurement per benchmark</Text>
              {screen === "compare" ? (
                <Text textStyle="label/S/regular" color="fg.muted">
                  These commits have no results on Linux x64.
                </Text>
              ) : null}
              <Button size="sm" variant="primary" onClick={() => setScreen("running")}>
                {screen === "compare" ? "Run benchmarks for both commits" : "Start run"}
              </Button>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      ) : null}
      {screen === "running" ? (
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="md">
              <Text textStyle="heading/S">Run 1044 · Running</Text>
              <Text textStyle="mono/XS">
                {base} → {head} · Linux x64
              </Text>
              <Text textStyle="label/S/regular">Storage finished · Runtime running · Elapsed 4 min</Text>
              <HStack gap="sm">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setScreen("partial");
                    setNotice("Run cancelled. The completed storage measurements remain available.");
                  }}
                >
                  Cancel run
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setScreen("results")}>
                  Preview completion
                </Button>
              </HStack>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      ) : null}
      {results || screen === "sync" ? (
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="md">
              <HStack justify="space-between" wrap="wrap" gap="sm">
                <Text textStyle="heading/S">Run 1044 · {screen === "partial" ? "Partial results" : "Finished"}</Text>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setNotice("Showing the cached results for run 1044.")}
                >
                  View results
                </Button>
              </HStack>
              <Text textStyle="mono/XS">{head} · Linux x64 · Elapsed 6 min</Text>
              {screen === "partial" ? (
                <AlertMessage status="warning" title="Runtime did not finish">
                  Storage measurements are available. Runtime measurements are missing.
                </AlertMessage>
              ) : null}
              <Text textStyle="label/S/medium">Storage results</Text>
              {MEASUREMENTS.map((metric) => (
                <HStack key={metric.label} justify="space-between" wrap="wrap" gap="md">
                  <Text textStyle="label/S/regular">{metric.label}</Text>
                  <Text textStyle="mono/XS">
                    {metric.value} · {metric.budget} · {metric.outcome}
                  </Text>
                </HStack>
              ))}
              <Text textStyle="label/S/regular" color="fg.muted">
                1 sample per metric. Insufficient evidence for a confidence interval or a significant change.
              </Text>
              <HStack gap="sm" wrap="wrap">
                <Button size="sm" variant="outline" onClick={() => setScreen("compare")}>
                  Compare commits
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setNotice("Raw sample: session badge query = 9.1 ms.")}
                >
                  Show measurements
                </Button>
              </HStack>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
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
