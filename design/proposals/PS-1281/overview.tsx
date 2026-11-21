import { Button, Grid, Stack, Text } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { DataTable } from "@pstdio/ui/data-table";
import { latency } from "./fixtures";

const Metric = (props: { label: string; value: string; detail: string }) => (
  <SimpleCard>
    <SimpleCardBody>
      <Stack gap="xs">
        <Text textStyle="label/S/regular" color="fg.muted">
          {props.label}
        </Text>
        <Text textStyle="heading/L">{props.value}</Text>
        <Text textStyle="label/XS/regular" color="fg.muted">
          {props.detail}
        </Text>
      </Stack>
    </SimpleCardBody>
  </SimpleCard>
);

interface OverviewProps {
  stale: boolean;
  failing: boolean;
  range: string;
  onChecks: () => void;
}

export const Overview = ({ stale, failing, range, onChecks }: OverviewProps) => {
  let probeSummary = "Access renewal, encrypted sync, blob integrity and two-device live delivery are passing.";
  if (failing) probeSummary = "HTTP health is responding, but encrypted sync and blob verification are failing.";
  if (stale)
    probeSummary = "No fresh probe results are available. Inspect the last observations and collection status.";
  return (
    <>
      <Grid templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }} gap="md">
        <Metric
          label="HTTP availability"
          value={stale ? "Unknown" : "100%"}
          detail="Observed samples in selected window"
        />
        <Metric label="Request latency · p95" value={stale ? "—" : "210 ms"} detail="Server request observations" />
        <Metric
          label="Account storage"
          value="38%"
          detail={stale ? "Last known usage" : "19 GiB of configured 50 GiB"}
        />
        <Metric
          label="Active alerts"
          value={failing ? "2" : "0"}
          detail={stale ? "Last known alert state" : "Evaluated on the server"}
        />
      </Grid>
      <SimpleCard>
        <SimpleCardBody>
          <Stack gap="sm">
            <Text textStyle="label/M/medium">Request latency · p95 · {range}</Text>
            <DataTable
              data={[
                {
                  metric: "Request latency · p95",
                  history: {
                    values: latency.map(({ ms }) => ms),
                    labels: latency.map(({ interval }) => `Interval ${interval + 1}`),
                  },
                },
              ]}
              columnRenderers={{ history: { type: "sparkline", unit: "ms" } }}
              defaultSettings={{ rowNumbers: false, rowHeight: "tall", showStats: false }}
              itemLabel="latency series"
            />
            <Text textStyle="label/XS/regular" color="fg.muted">
              Missing samples remain gaps; no observation is treated as zero.
            </Text>
          </Stack>
        </SimpleCardBody>
      </SimpleCard>
      <SimpleCard>
        <SimpleCardBody>
          <Stack gap="sm">
            <Text textStyle="label/M/medium">{failing ? "Storage is blocking sync" : "Synthetic checks"}</Text>
            <Text textStyle="body/S">{probeSummary}</Text>
            <Button size="xs" variant="ghost" alignSelf="flex-start" onClick={onChecks}>
              Inspect checks
            </Button>
          </Stack>
        </SimpleCardBody>
      </SimpleCard>
      <Text textStyle="body/S" color="fg.muted">
        Backup evidence: Not configured.
      </Text>
    </>
  );
};
