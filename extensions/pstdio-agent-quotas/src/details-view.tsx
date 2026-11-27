import "@pstdio/ui/style.css";
import { Box, Button, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { createWebviewClient, defineExtensionView, type WebviewClient } from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery, useWebviewScope, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
// The same harness dropdown as Settings › Runtime, without the model menu.
import { HarnessModelMenu } from "@pstdio/ui/param-editor";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { commands } from "./commands";
import { forecastLimit, formatPercent, formatResetIn, remainingColor } from "./format";
import { type ProviderQuotas, type QuotaLimit, type QuotaStatus, quotasChanged } from "./shared";
import { QuotaTranslations, type Translate, useT } from "./translations";
import { useAutoRefresh } from "./use-auto-refresh";

// Re-renders every 30 seconds so "resets in" counts down while the popover is open.
const useNow = () => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

// `observedAt` is when the reading was taken: the forecast pace uses it, countdowns use `now`.
const LimitRow = (props: { limit: QuotaLimit; observedAt: number; now: number }) => {
  const { limit, observedAt, now } = props;
  const t = useT();
  const resetIn = formatResetIn(limit.resetsAt, now);
  const forecast = forecastLimit(limit, observedAt, now);
  const runsOutIn = forecast?.runsOutAt ? formatResetIn(new Date(forecast.runsOutAt).toISOString(), now) : undefined;
  const color = remainingColor(limit, observedAt, now);
  return (
    <Stack gap="2xs">
      <HStack justify="space-between" gap="md">
        <Text textStyle="sm">{limit.label}</Text>
        <Text textStyle="mono/XS" color={color}>
          {t("details.left", "{{percent}} left", { percent: formatPercent(limit) })}
        </Text>
      </HStack>
      <Box h="1" bg="bg.muted" borderRadius="full" overflow="hidden">
        <Box
          h="full"
          w={`${Math.max(0, Math.min(100, limit.remainingPercent))}%`}
          bg={color === "fg.muted" ? "fg.subtle" : color}
        />
      </Box>
      {resetIn || forecast ? (
        <HStack justify="space-between" gap="md">
          <Text textStyle="xs" color="fg.subtle">
            {resetText(t, resetIn)}
          </Text>
          {forecast ? (
            <Text textStyle="xs" color={runsOutIn ? color : "fg.subtle"}>
              {runsOutIn
                ? t("details.runsOutIn", "Runs out in {{time}} at this pace", { time: runsOutIn })
                : t("details.onPace", "On pace for {{percent}}%", {
                    percent: Math.round(forecast.projectedPercent),
                  })}
            </Text>
          ) : null}
        </HStack>
      ) : null}
    </Stack>
  );
};

const checkedText = (t: Translate, at: string, now: number) => {
  const minutes = Math.round((now - Date.parse(at)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return t("details.checkedJustNow", "Checked just now");
  if (minutes < 60) return t("details.checkedMinutes", "Checked {{count}}m ago", { count: minutes });
  return t("details.checkedHours", "Checked {{count}}h ago", { count: Math.round(minutes / 60) });
};

const resetText = (t: Translate, resetIn: string | undefined) => {
  if (!resetIn) return "";
  if (resetIn === "now") return t("details.resettingNow", "Resetting now");
  return t("details.resetsIn", "Resets in {{time}}", { time: resetIn });
};

/** What the popover says while it has no quotas to show. */
const placeholder = (t: Translate, pendingLabel: string | undefined, loading: boolean) => {
  if (pendingLabel) return t("details.readingProvider", "Reading {{provider}} quotas…", { provider: pendingLabel });
  if (loading) return t("details.reading", "Reading quotas…");
  return t("details.noHarness", "No agent harness with quota support is turned on in this project.");
};

const CheckedAgo = (props: { at: string; now: number }) => {
  const t = useT();
  return (
    <Text textStyle="xs" color="fg.subtle">
      {checkedText(t, props.at, props.now)}
    </Text>
  );
};

const ProviderSection = (props: { provider: ProviderQuotas; now: number }) => {
  const { provider, now } = props;
  const t = useT();
  return (
    <Stack gap="sm">
      <CheckedAgo at={provider.checkedAt} now={now} />
      {provider.status === "available" ? (
        provider.limits.map((limit) => (
          <LimitRow key={limit.id} limit={limit} observedAt={Date.parse(provider.checkedAt)} now={now} />
        ))
      ) : (
        <Text textStyle="sm" color="fg.muted">
          {provider.message ?? t("details.noData", "No quota data for this sign-in.")}
        </Text>
      )}
    </Stack>
  );
};

const Details = (props: { client: WebviewClient<typeof commands> }) => {
  const { client } = props;
  const t = useT();
  useWebviewScope(client.queries);
  const now = useNow();
  const visible = useWebviewVisibility();
  const query = useWebviewCommandQuery(client.commands.status.query({}, { events: [quotasChanged] }), visible);
  useAutoRefresh(query.refresh, visible);
  // The provider being switched to, while its first read runs.
  const [pending, setPending] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string>();
  // Both actions save and emit `quotas.changed`, which makes the query read again.
  const run = async (action: () => Promise<unknown>) => {
    setActionError(undefined);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };
  const refresh = async () => {
    setRefreshing(true);
    await run(() => client.commands.refresh());
    setRefreshing(false);
  };
  // The select command returns the new provider's quotas. Show them at once: the query
  // refetches a moment later on the change event and would briefly show the old provider.
  const [chosen, setChosen] = useState<QuotaStatus>();
  const select = async (provider: string) => {
    if (provider === (chosen ?? query.data)?.selected?.id) return;
    setPending(provider);
    await run(async () => setChosen((await client.commands.select({ provider })) as QuotaStatus));
    setPending(undefined);
  };
  // Drop the returned value once the query has caught up with it.
  useEffect(() => {
    if (chosen && query.data?.selected?.id === chosen.selected?.id) setChosen(undefined);
  }, [chosen, query.data]);
  const data = chosen ?? query.data;
  const options = data?.options;
  const selected = data?.selected;
  const pendingLabel = options?.find((option) => option.id === pending)?.label;

  return (
    <Stack p="md" gap="md" minW="72">
      <Flex justify="space-between" align="center" gap="sm">
        {options && options.length > 0 ? (
          <HarnessModelMenu
            agentOptions={options.map((option) => ({ value: option.id, label: option.label }))}
            selectedAgent={pending ?? selected?.id ?? ""}
            onSelectAgent={(id) => void select(id)}
            offersModels={false}
            modelOptions={[]}
            selectedModel=""
            onSelectModel={() => {}}
            isDisabled={pending !== undefined}
            labels={{
              agentSelect: t("details.select", "Show quotas for"),
              agentUnknown: t("details.noAgent", "No agent available"),
            }}
            size="xs"
          />
        ) : (
          <Text textStyle="sm" fontWeight="semibold">
            {t("views.details", "Agent quotas")}
          </Text>
        )}
        <Button
          size="2xs"
          variant="ghost"
          onClick={refresh}
          loading={refreshing}
          disabled={!selected || pending !== undefined}
          aria-label={t("details.refresh", "Refresh quotas")}
        >
          <RefreshCw size={14} />
        </Button>
      </Flex>
      {query.error ? (
        <Text role="alert" textStyle="sm" color="fg.error">
          {String(query.error)}
        </Text>
      ) : null}
      {actionError ? (
        <Text role="alert" textStyle="sm" color="fg.error">
          {actionError}
        </Text>
      ) : null}
      {selected && !pendingLabel ? (
        <ProviderSection provider={selected} now={now} />
      ) : (
        <Text textStyle="sm" color="fg.muted">
          {placeholder(t, pendingLabel, data === undefined)}
        </Text>
      )}
    </Stack>
  );
};

export default defineExtensionView({
  render(context) {
    const client = createWebviewClient<typeof commands>(context.host);
    const root = createRoot(context.mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <QuotaTranslations value={context.t}>
          <Details client={client} />
        </QuotaTranslations>
      </ChakraProvider>,
    );
    return () => {
      root.unmount();
      client.queries.dispose();
    };
  },
});
