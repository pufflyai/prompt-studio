import { Button, createListCollection, Flex, Grid, Input, Portal, Select, Stack, Text } from "@chakra-ui/react";
import type { PageParams, ResourceRef } from "@pstdio/sdk/extensions";
import { ScrollArea, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { machineStates } from "./machine-status";
import { ActivityChart, CostChart } from "./workspace-monitoring-chart";
import type { MonitoringClient, MonitoringSummary } from "./workspace-monitoring-client";
import { WorkspaceMonitoringInventory } from "./workspace-monitoring-inventory";
import {
  Metric,
  MonitoringError,
  MonitoringRangeControl,
  monitoringFormat,
  type Translate,
} from "./workspace-monitoring-ui";

interface DashboardProps {
  client: MonitoringClient;
  range: string;
  state?: string;
  name?: string;
  update(params: PageParams): void;
  open(resource: ResourceRef): void;
  locale: string;
  t: Translate;
}

function WorkspaceFilters(props: Pick<DashboardProps, "state" | "name" | "update" | "t">) {
  const { state, name, update, t } = props;
  const [query, setQuery] = useState(name ?? "");
  const collection = createListCollection({
    items: [{ value: "all", label: t("cloud-workspaces.monitoring-all-states", "All states") }, ...machineStates],
  });
  const label = t("cloud-workspaces.monitoring-name", "Exact workspace name");
  return (
    <Flex gap="xs" wrap="wrap" align="center">
      <Flex
        as="form"
        gap="xs"
        wrap="wrap"
        onSubmit={(event: React.FormEvent) => {
          event.preventDefault();
          update({ "monitoring-name": query.trim() });
        }}
      >
        <Input
          aria-label={label}
          placeholder={label}
          size="sm"
          w="2xs"
          maxW="full"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" size="sm">
          {t("cloud-workspaces.monitoring-search", "Search")}
        </Button>
        {name && (
          <Button type="button" size="sm" variant="ghost" onClick={() => update({ "monitoring-name": "" })}>
            {t("cloud-workspaces.monitoring-clear", "Clear search")}
          </Button>
        )}
      </Flex>
      <Select.Root
        size="sm"
        w="2xs"
        maxW="full"
        collection={collection}
        value={[state || "all"]}
        onValueChange={({ value }) => update({ "monitoring-state": value[0] === "all" ? "" : (value[0] ?? "") })}
      >
        <Select.HiddenSelect aria-label={t("cloud-workspaces.state", "State")} />
        <Select.Control>
          <Select.Trigger aria-label={t("cloud-workspaces.monitoring-filter-state", "Filter by workspace state")}>
            <Select.ValueText />
          </Select.Trigger>
          <Select.IndicatorGroup>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>
        <Portal>
          <Select.Positioner>
            <Select.Content>
              {collection.items.map((item) => (
                <Select.Item key={item.value} item={item}>
                  <Select.ItemText>{item.label}</Select.ItemText>
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Portal>
      </Select.Root>
    </Flex>
  );
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
  const { client, range, state, name, update, open, locale, t } = props;
  const [summary, setSummary] = useState<MonitoringSummary>();
  const [error, setError] = useState<string>();
  const [dismissed, setDismissed] = useState(false);
  const [refresh, setRefresh] = useState(0);

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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDismissed(false);
                setRefresh((value) => value + 1);
              }}
            >
              {t("cloud-workspaces.refresh", "Refresh")}
            </Button>
          </Flex>
        </Flex>
        <WorkspaceFilters key={name} state={state} name={name} update={update} t={t} />
      </Stack>
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
          <Text as="h2" textStyle="heading/S">
            {t("cloud-workspaces.monitoring-inventory", "Workspaces")}
          </Text>
          <WorkspaceMonitoringInventory
            key={JSON.stringify([state, name, refresh])}
            client={client}
            range={range}
            state={state}
            name={name}
            open={open}
            locale={locale}
            t={t}
          />
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
