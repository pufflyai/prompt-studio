import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { Chip, ScrollArea, SegmentedControl, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { DataTable } from "@pstdio/ui/data-table";
import { useState } from "react";
import { type Condition, checkRows, infrastructureRows, sections, storageRows } from "./fixtures";

import { Overview } from "./overview";

interface RelayMonitorDesignProps {
  condition: Condition;
}

const Connection = (props: { onConnect: () => void }) => (
  <SimpleCard>
    <SimpleCardBody>
      <Stack gap="md" maxW="2xl">
        <Text textStyle="heading/M">Connect monitoring</Text>
        <Text textStyle="body/S">Use the read-only query connection configured in Prompt Studio settings.</Text>
        <Text textStyle="body/S" color="fg.muted">
          Collection, history and alerts run on the server. This page never needs database, object storage, or
          monitoring-device credentials.
        </Text>
        <Button alignSelf="flex-start" size="sm" onClick={props.onConnect}>
          Check connection
        </Button>
        <Text textStyle="label/XS/regular" color="fg.muted">
          Preview uses synthetic data and makes no network requests.
        </Text>
      </Stack>
    </SimpleCardBody>
  </SimpleCard>
);

export const RelayMonitorDesign = (props: RelayMonitorDesignProps) => {
  const { condition } = props;
  const [section, setSection] = useState("Overview");
  const [environment, setEnvironment] = useState("Production");
  const [range, setRange] = useState("24h");
  const [selected, setSelected] = useState("health");
  const [connected, setConnected] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const rows = checkRows(condition);
  const detail = rows.find((row) => row.id === selected) ?? rows[0];
  const stale = condition === "stale";
  const unavailable = condition === "disconnected" && !connected;
  const setup = condition === "setup" && !connected;
  const failing = condition === "storage-failure";
  let status = "Healthy";
  if (failing) status = "Storage checks failing";
  if (stale || unavailable) status = "Unknown";
  if (setup) status = "Not connected";

  return (
    <Flex h="100dvh" direction="column" overflow="hidden" bg="bg" color="fg">
      <Stack p="md" gap="sm" flexShrink={0}>
        <Flex gap="md" justify="space-between" align="center" wrap="wrap">
          <Flex gap="sm" align="center">
            <Text textStyle="heading/M">Relay monitoring</Text>
            <Chip>{status}</Chip>
          </Flex>
          <SegmentedControl
            aria-label="Environment"
            value={environment}
            onValueChange={setEnvironment}
            options={["Production", "Staging"].map((value) => ({ value, label: value }))}
          />
        </Flex>
        <Flex gap="sm" justify="space-between" align="center" wrap="wrap">
          <SegmentedControl
            aria-label="Monitoring section"
            value={section}
            onValueChange={setSection}
            options={sections.map((value) => ({ value, label: value }))}
          />
          <Flex gap="sm" align="center">
            <SegmentedControl
              aria-label="Time range"
              value={range}
              onValueChange={setRange}
              options={["1h", "24h", "7d"].map((value) => ({ value, label: value }))}
            />
            <Button size="xs" variant="ghost" onClick={() => setRefreshed(true)}>
              Refresh
            </Button>
          </Flex>
        </Flex>
        <Text textStyle="label/XS/regular" color="fg.muted">
          {environment} · {stale ? "Last observation 12 min ago" : "Last observation 20 sec ago"}
          {refreshed ? " · Query refreshed" : ""} · {range} window
        </Text>
      </Stack>
      <ScrollArea flex="1" minH="0">
        <Stack p="md" gap="md">
          {stale && (
            <SimpleCard>
              <SimpleCardBody>
                <Text textStyle="body/S">
                  Collector data is stale. Current relay health is unknown. Last known observations remain available.
                </Text>
              </SimpleCardBody>
            </SimpleCard>
          )}
          {unavailable && (
            <SimpleCard>
              <SimpleCardBody>
                <Stack gap="sm">
                  <Text textStyle="body/S">
                    The query connection is unavailable. This does not establish a relay outage.
                  </Text>
                  <Button size="sm" alignSelf="flex-start" onClick={() => setConnected(true)}>
                    Retry connection
                  </Button>
                </Stack>
              </SimpleCardBody>
            </SimpleCard>
          )}
          {(setup || section === "Connection") && <Connection onConnect={() => setConnected(true)} />}
          {!setup && !unavailable && section === "Overview" && (
            <Overview stale={stale} failing={failing} range={range} onChecks={() => setSection("Checks")} />
          )}
          {!setup && !unavailable && section === "Checks" && (
            <>
              <DataTable
                data={rows}
                hiddenColumns={["id", "detail"]}
                getRowId={(row) => String(row.id)}
                defaultSettings={{ rowNumbers: false }}
                activeRowId={selected}
                enableRowActivation
                onRowClick={(row) => setSelected(String(row.id))}
                itemLabel="check"
              />
              <SimpleCard>
                <SimpleCardBody>
                  <Stack gap="sm">
                    <Text textStyle="label/M/medium">
                      {detail.check} · {detail.state}
                    </Text>
                    <Text textStyle="body/S">{detail.detail}</Text>
                    <Text textStyle="label/XS/regular" color="fg.muted">
                      {stale ? "Last observed 12 min ago" : "Last checked 20 sec ago"}
                    </Text>
                  </Stack>
                </SimpleCardBody>
              </SimpleCard>
            </>
          )}
          {!setup && !unavailable && section === "Storage" && (
            <>
              <Text textStyle="body/S" color="fg.muted">
                Aggregate account and project metadata. Content stays encrypted.
              </Text>
              <DataTable
                data={storageRows}
                hiddenColumns={["id"]}
                getRowId={(row) => String(row.id)}
                defaultSettings={{ rowNumbers: false }}
                itemLabel="storage observation"
              />
            </>
          )}
          {!setup && !unavailable && section === "Failures" && (
            <>
              <Text textStyle="body/S" color="fg.muted">
                Fixed failure codes only · selected environment and time window
              </Text>
              <DataTable
                data={
                  failing
                    ? [
                        { id: "1", observed: "17:42 UTC", code: "asset_operation_failed", count: 6 },
                        { id: "2", observed: "17:42 UTC", code: "sync_document_failed", count: 3 },
                      ]
                    : []
                }
                hiddenColumns={["id"]}
                getRowId={(row) => String(row.id)}
                defaultSettings={{ rowNumbers: false }}
                itemLabel="failure"
              />
            </>
          )}
          {!setup && !unavailable && section === "Infrastructure" && (
            <DataTable
              data={infrastructureRows}
              hiddenColumns={["id"]}
              getRowId={(row) => String(row.id)}
              defaultSettings={{ rowNumbers: false }}
              itemLabel="infrastructure observation"
            />
          )}
          <Box>
            <Text textStyle="label/XS/regular" color="fg.muted">
              Synthetic proposal preview · no production queries or changes
            </Text>
          </Box>
        </Stack>
      </ScrollArea>
    </Flex>
  );
};
