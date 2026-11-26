import { Flex, Grid, Stack, Text } from "@chakra-ui/react";
import type { PageParams, ResourceRef } from "@pstdio/sdk/extensions";
import { ScrollArea, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { CollectionViewBar, useCollectionViewStore, type ViewFilterGroup } from "@pstdio/ui/collection-view";
import { useEffect, useEffectEvent, useId, useState } from "react";
import { machineStates } from "./machine-status";
import { ActivityChart, CostChart } from "./workspace-monitoring-chart";
import type { MonitoringClient, MonitoringSummary } from "./workspace-monitoring-client";
import { allowedWorkspaceStates, readWorkspaceFilter, workspaceFilterFields } from "./workspace-monitoring-filters";
import { WorkspaceMonitoringInventory } from "./workspace-monitoring-inventory";
import {
  Metric,
  MonitoringAction,
  MonitoringError,
  MonitoringRangeControl,
  monitoringFormat,
  type Translate,
} from "./workspace-monitoring-ui";

interface DashboardProps {
  client: MonitoringClient;
  range: string;
  filterValue?: string;
  name?: string;
  update(params: PageParams): void;
  open(resource: ResourceRef): void;
  locale: string;
  t: Translate;
}

function Overview(props: { summary: MonitoringSummary; range: string; locale: string; t: Translate }) {
  const { summary, range, locale, t } = props;
  const { usage } = summary;
  const format = monitoringFormat(locale, t);
  return (
    <>
      <Grid templateColumns={{ base: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }} gap="sm">
        <Metric
          label={t("cloud-workspaces.history-running-now", "Running now")}
          value={format.number.format(summary.running)}
        />
        <Metric
          label={t("cloud-workspaces.history-peak", "Peak in range")}
          value={format.number.format(summary.peak)}
        />
        <Metric
          label={t("cloud-workspaces.monitoring-runtime", "Ready time in range")}
          value={format.hours(usage.runtimeMs)}
        />
        <Metric
          label={
            usage.unpricedRuntimeMs && usage.costUsd !== null
              ? t("cloud-workspaces.monitoring-estimate-partial", "Estimated compute cost · partial")
              : t("cloud-workspaces.monitoring-estimate", "Estimated compute cost")
          }
          value={format.money(usage.costUsd)}
        />
      </Grid>
      <Grid templateColumns={{ base: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }} gap="sm">
        <SimpleCard minW="0">
          <SimpleCardBody>
            <Stack gap="sm">
              <Text as="h2" textStyle="heading/S">
                {t("cloud-workspaces.history-running-title", "Running workspaces")}
              </Text>
              <ActivityChart key={range} points={summary.points} peak={summary.peak} locale={locale} t={t} />
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
        <SimpleCard minW="0">
          <SimpleCardBody>
            <Stack gap="sm">
              <Text as="h2" textStyle="heading/S">
                {t("cloud-workspaces.monitoring-estimate", "Estimated compute cost")}
              </Text>
              {usage.costUsd === null ? (
                <Text color="fg.muted">
                  {t(
                    "cloud-workspaces.monitoring-cost-unavailable",
                    "Set a default hourly rate in Cloud Workspaces settings. Different template rates require per-template activity from the controller.",
                  )}
                </Text>
              ) : (
                <CostChart key={range} buckets={summary.buckets} locale={locale} t={t} />
              )}
              {usage.unpricedRuntimeMs > 0 && (
                <Text color="fg.muted">
                  {t("cloud-workspaces.monitoring-missing-rates", "{{runtime}} without a rate", {
                    runtime: format.hours(usage.unpricedRuntimeMs),
                  })}
                </Text>
              )}
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      </Grid>
    </>
  );
}

export function WorkspaceMonitoringDashboard(props: DashboardProps) {
  const { client, range, filterValue, name, update, open, locale, t } = props;
  const [summary, setSummary] = useState<MonitoringSummary>();
  const [error, setError] = useState<string>();
  const [dismissed, setDismissed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState(name ?? "");
  const [query, setQuery] = useState(() => search.trim());
  useEffect(() => setSearch(name ?? ""), [name]);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [search]);
  const storageKey = useId();
  const [initialState] = useState(() => ({ settings: {}, filter: readWorkspaceFilter(filterValue) }));
  const filter = useCollectionViewStore(storageKey, initialState, (state) => state.filter);
  const fields = workspaceFilterFields(t("cloud-workspaces.state", "State"));
  const allowedStates = allowedWorkspaceStates(filter, fields);
  const persistFilter = useEffectEvent((next: ViewFilterGroup) => {
    const value = next.rules.length || next.groups?.length ? JSON.stringify(next) : "";
    if (value !== (filterValue ?? "")) update({ "monitoring-filter": value });
  });
  useEffect(() => persistFilter(filter), [filter]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter explicitly starts a fresh read.
  useEffect(() => {
    const abort = new AbortController();
    let loading = false;
    const request = client.commands["deployed.monitoring-summary"].query({ range });
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const value = await request.refresh(abort.signal);
        if (abort.signal.aborted) return;
        setSummary(value);
        setError(undefined);
        setDismissed(false);
      } catch (error) {
        if (!abort.signal.aborted) setError(error instanceof Error ? error.message : String(error));
      } finally {
        loading = false;
      }
    };
    const refreshVisible = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(refreshVisible, 30_000);
    document.addEventListener("visibilitychange", refreshVisible);
    void load();
    return () => {
      abort.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [client, range, refresh]);

  return (
    <Stack h="full" minH="0" gap="0">
      <Stack as="header" gap="sm" p="md" flexShrink={0} borderBottomWidth="1px">
        <Flex justify="space-between" align="center" gap="sm" wrap="wrap">
          <Text color="fg.muted" textStyle="label/S/regular">
            {summary?.name}
          </Text>
          <Flex align="center" gap="xs" wrap="wrap">
            <MonitoringRangeControl range={range} onChange={(value) => update({ "monitoring-range": value })} t={t} />
          </Flex>
        </Flex>
      </Stack>
      <CollectionViewBar
        storageKey={storageKey}
        initialState={initialState}
        views={[]}
        fields={fields}
        optionsFor={() => machineStates}
        search={search}
        searchResultLabel={search ? t("cloud-workspaces.monitoring-search-exact", "Exact name") : undefined}
        onSearchChange={(value) => {
          setSearch(value);
          update({ "monitoring-name": value });
        }}
        leading={
          <Text hideBelow="sm" textStyle="label/S/medium">
            {t("cloud-workspaces.monitoring-inventory", "Workspaces")}
          </Text>
        }
        displayControl={null}
        actions={
          <MonitoringAction
            label={t("cloud-workspaces.refresh", "Refresh")}
            icon="refresh"
            onClick={() => {
              setDismissed(false);
              setRefresh((value) => value + 1);
            }}
          />
        }
      />
      <ScrollArea flex="1" minH="0">
        <Stack p="md" gap="md">
          {error && !dismissed && (
            <MonitoringError
              message={error}
              t={t}
              retry={() => setRefresh((value) => value + 1)}
              dismiss={() => setDismissed(true)}
            />
          )}
          {!error && !summary && (
            <Text role="status" color="fg.muted">
              {t("cloud-workspaces.monitoring-loading", "Loading workspace monitoring…")}
            </Text>
          )}
          {summary && <Overview summary={summary} range={range} locale={locale} t={t} />}
          <WorkspaceMonitoringInventory
            key={JSON.stringify([allowedStates, query, refresh])}
            client={client}
            range={range}
            allowedStates={allowedStates}
            name={query}
            open={open}
            locale={locale}
            t={t}
          />
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
