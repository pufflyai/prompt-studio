import { Flex, Grid, Stack, Text } from "@chakra-ui/react";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { ScrollArea, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { MonitoringClient, MonitoringDetail } from "./workspace-monitoring-client";
import {
  Metric,
  MonitoringAction,
  MonitoringError,
  MonitoringRangeControl,
  monitoringFormat,
  type Translate,
} from "./workspace-monitoring-ui";

interface DetailProps {
  client: MonitoringClient;
  machineId: string;
  range: string;
  changeRange(value: string): void;
  openOutput(resource: ResourceRef): void;
  locale: string;
  t: Translate;
}

export function WorkspaceMonitoringDetail(props: DetailProps) {
  const { client, machineId, range, changeRange, openOutput, locale, t } = props;
  const [detail, setDetail] = useState<MonitoringDetail>();
  const [error, setError] = useState<string>();
  const [dismissed, setDismissed] = useState(false);
  const [retry, setRetry] = useState(0);
  const format = monitoringFormat(locale, t);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter explicitly starts a fresh read.
  useEffect(() => {
    const abort = new AbortController();
    setError(undefined);
    setDismissed(false);
    const request = client.commands["deployed.monitoring-workspace"].query({ machineId, range });
    void request.refresh(abort.signal).then(
      (value) => {
        if (!abort.signal.aborted) setDetail(value);
      },
      (error) => {
        if (!abort.signal.aborted) setError(error instanceof Error ? error.message : String(error));
      },
    );
    return () => abort.abort();
  }, [client, machineId, range, retry]);

  const unavailable = t("cloud-workspaces.monitoring-unavailable", "Unavailable");
  const timestamp = (value: string | null | undefined, empty: string) => {
    if (value === null) return empty;
    const time = value ? Date.parse(value) : NaN;
    return Number.isFinite(time) ? format.date.format(time) : unavailable;
  };
  const fields = detail
    ? [
        [t("cloud-workspaces.template", "Template"), `${detail.template}@${detail.version}`],
        [t("cloud-workspaces.created-at", "Created at"), timestamp(detail.createdAt, unavailable)],
        [
          t("cloud-workspaces.monitoring-ready-at", "Ready at"),
          timestamp(detail.readyAt, t("cloud-workspaces.monitoring-never-ready", "Never ready")),
        ],
        [
          t("cloud-workspaces.monitoring-ended-at", "Ended at"),
          timestamp(detail.terminalAt, t("cloud-workspaces.monitoring-not-ended", "Not ended")),
        ],
        [t("cloud-workspaces.monitoring-hourly-rate", "Rate per ready hour"), format.money(detail.hourlyUsd)],
        ...(detail.reason ? [[t("cloud-workspaces.reason", "Reason"), detail.reason]] : []),
      ]
    : [];

  return (
    <Stack h="full" minH="0" gap="0">
      <Flex as="header" p="md" gap="sm" justify="space-between" wrap="wrap" flexShrink={0} borderBottomWidth="1px">
        <MonitoringRangeControl range={range} onChange={changeRange} t={t} />
        <Flex gap="xs" wrap="wrap">
          {detail && (
            <MonitoringAction
              icon="refresh"
              label={t("cloud-workspaces.refresh", "Refresh")}
              onClick={() => setRetry((value) => value + 1)}
            />
          )}
          {detail && (
            <MonitoringAction
              icon="file-text"
              label={t("cloud-workspaces.monitoring-open-output", "Open output and logs")}
              onClick={() => openOutput(detail.resource)}
            />
          )}
        </Flex>
      </Flex>
      <ScrollArea flex="1" minH="0">
        <Stack p="md" gap="md">
          {error && !dismissed && (
            <MonitoringError
              message={error}
              t={t}
              dismiss={() => setDismissed(true)}
              retry={() => setRetry((value) => value + 1)}
            />
          )}
          {!error && !detail && (
            <Text role="status" color="fg.muted">
              {t("cloud-workspaces.monitoring-loading", "Loading workspace monitoring…")}
            </Text>
          )}
          {detail && (
            <>
              <Text as="h1" textStyle="heading/M">
                {detail.name}
              </Text>
              <Grid templateColumns={{ base: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" }} gap="sm">
                <Metric label={t("cloud-workspaces.status", "Status")} value={detail.status} />
                <Metric
                  label={t("cloud-workspaces.monitoring-runtime", "Ready time in range")}
                  value={format.hours(detail.runtimeMs)}
                />
                <Metric
                  label={t("cloud-workspaces.monitoring-estimate", "Estimated compute cost")}
                  value={format.money(detail.costUsd)}
                />
              </Grid>
              <SimpleCard>
                <SimpleCardBody>
                  <Stack as="dl" gap="sm">
                    {fields.map(([label, value]) => (
                      <Flex key={label} gap="sm" justify="space-between" wrap="wrap">
                        <Text as="dt" color="fg.muted">
                          {label}
                        </Text>
                        <Text as="dd" overflowWrap="anywhere">
                          {value}
                        </Text>
                      </Flex>
                    ))}
                  </Stack>
                </SimpleCardBody>
              </SimpleCard>
            </>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
