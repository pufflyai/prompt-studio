import "@pstdio/ui/style.css";
import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { createWebviewClient, defineExtensionView, type WebviewClient } from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery, useWebviewScope, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { Hourglass } from "lucide-react";
import { Component, type ContextType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { commands } from "./commands";
import { formatPercent, headlineLimits, remainingColor } from "./format";
import { type ProviderQuotas, quotasChanged } from "./shared";
import { QuotaTranslations, useT } from "./translations";
import { useAutoRefresh } from "./use-auto-refresh";

const ProviderReadout = (props: { provider: ProviderQuotas }) => {
  const { provider } = props;
  const t = useT();
  const { session, weekly } = headlineLimits(provider);
  const observedAt = Date.parse(provider.checkedAt);
  if (provider.status !== "available") {
    return (
      <Text textStyle="mono/XS" color="fg.subtle" whiteSpace="nowrap">
        {`${provider.short} –`}
      </Text>
    );
  }
  return (
    <HStack gap="2xs" whiteSpace="nowrap">
      <Text textStyle="mono/XS">{provider.short}</Text>
      <Text textStyle="mono/XS" color={remainingColor(session, observedAt)}>
        {t("meter.session", "5h {{percent}}", { percent: formatPercent(session) })}
      </Text>
      <Text textStyle="mono/XS" color="fg.subtle">
        ·
      </Text>
      <Text textStyle="mono/XS" color={remainingColor(weekly, observedAt)}>
        {t("meter.weekly", "wk {{percent}}", { percent: formatPercent(weekly) })}
      </Text>
    </HStack>
  );
};

const Meter = (props: { client: WebviewClient<typeof commands> }) => {
  const { client } = props;
  const t = useT();
  useWebviewScope(client.queries);
  const visible = useWebviewVisibility();
  const query = useWebviewCommandQuery(client.commands.status.query({}, { events: [quotasChanged] }), visible);
  useAutoRefresh(query.refresh, visible);
  const provider = query.data?.selected;
  const limits = provider ? headlineLimits(provider) : undefined;
  const label =
    provider && limits
      ? t(
          "meter.label",
          "{{provider}}: {{session}} of the 5-hour window and {{weekly}} of the week left. Show quota details.",
          {
            provider: provider.label,
            session: formatPercent(limits.session),
            weekly: formatPercent(limits.weekly),
          },
        )
      : t("meter.labelEmpty", "Agent quotas. Show details.");
  // Always draw something: a status webview with no width is never laid out again.
  return (
    <Button variant="ghost" size="2xs" tabIndex={-1} h="100dvh" gap="xs" color="fg.muted" aria-label={label}>
      <Box as="span" display="inline-flex">
        <Hourglass size={14} />
      </Box>
      {provider ? (
        <ProviderReadout provider={provider} />
      ) : (
        <Text textStyle="mono/XS" whiteSpace="nowrap">
          {query.error || query.data ? t("meter.none", "Quotas –") : "…"}
        </Text>
      )}
    </Button>
  );
};

// A status webview that renders nothing has no width and is never laid out again,
// so a failure shows a marker instead of silently disappearing.
class MeterBoundary extends Component<{ children: ReactNode }, { error?: unknown }> {
  static contextType = QuotaTranslations;
  declare context: ContextType<typeof QuotaTranslations>;
  state: { error?: unknown } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (this.state.error === undefined) return this.props.children;
    console.error("[agent-quotas]", this.state.error);
    const t = this.context;
    return (
      <Button
        variant="ghost"
        size="2xs"
        tabIndex={-1}
        h="100dvh"
        gap="xs"
        color="fg.warning"
        aria-label={t("meter.failedLabel", "Agent quotas failed to load")}
      >
        <Hourglass size={14} />
        <Text textStyle="mono/XS">{t("meter.failed", "Quotas !")}</Text>
      </Button>
    );
  }
}

export default defineExtensionView({
  render(context) {
    const client = createWebviewClient<typeof commands>(context.host);
    const root = createRoot(context.mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <QuotaTranslations value={context.t}>
          <MeterBoundary>
            <Meter client={client} />
          </MeterBoundary>
        </QuotaTranslations>
      </ChakraProvider>,
    );
    return () => {
      root.unmount();
      client.queries.dispose();
    };
  },
});
