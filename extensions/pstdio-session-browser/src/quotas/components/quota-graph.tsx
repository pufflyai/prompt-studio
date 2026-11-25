import { Box, Button, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ScopedMenu as Menu } from "@pstdio/ui";
import { useState } from "react";
import { quotaSeries } from "../quota-history";
import { quotaSelection } from "../quota-selection";
import type { QuotaReport } from "../quotas";
import { QuotaHistoryChart } from "./quota-history-chart";
import { QuotaIcon } from "./quota-icon";

interface QuotaGraphProps {
  providers: QuotaReport[];
  loading: boolean;
  error?: string;
}

const QuotaUsageSummary = (props: { remainingPercent: number }) => {
  const { remainingPercent } = props;
  return (
    <Text textStyle="paragraph/M/medium">
      {Math.round(100 - remainingPercent)}% used · {Math.round(remainingPercent)}% remaining
    </Text>
  );
};

export const QuotaGraph = (props: QuotaGraphProps) => {
  const { providers, loading, error } = props;
  const [selectedId, setSelectedId] = useState<string>();
  const { available, selected } = quotaSelection(providers, selectedId);
  if (!selected && !error) {
    if (loading)
      return (
        <Text color="fg.muted" role="status">
          Checking quotas…
        </Text>
      );
    return (
      <EmptyState
        role="status"
        icon={<QuotaIcon name="gauge" />}
        title="No agent quotas are available"
        description={
          providers.length > 0
            ? "Your enabled harnesses haven’t reported quota data."
            : "Enable a harness that reports account usage to see quotas here."
        }
      />
    );
  }
  const singleLimit = selected?.limits.length === 1 ? selected.limits[0] : undefined;
  const heading = selected && (
    <HStack justify={singleLimit ? "space-between" : "flex-end"} minW="0" flexWrap="wrap">
      {available.length > 1 ? (
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button size="sm" variant="ghost" aria-label={`Quota harness: ${selected.label}`} maxW="full">
              <QuotaIcon name={selected.icon ?? "terminal"} />
              <Text truncate>{selected.label}</Text>
              <QuotaIcon name="chevron-down" />
            </Button>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.RadioItemGroup value={selected.id} onValueChange={({ value }) => setSelectedId(value)}>
                {available.map((provider) => (
                  <Menu.RadioItem key={provider.id} value={provider.id}>
                    <QuotaIcon name={provider.icon ?? "terminal"} />
                    <Menu.ItemText>{provider.label}</Menu.ItemText>
                    <Menu.ItemIndicator>
                      <QuotaIcon name="check" />
                    </Menu.ItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      ) : (
        <HStack gap="sm" minW="0">
          <QuotaIcon name={selected.icon ?? "terminal"} />
          <Text textStyle="paragraph/M/medium" truncate>
            {selected.label}
          </Text>
        </HStack>
      )}
      {singleLimit && <QuotaUsageSummary remainingPercent={singleLimit.remainingPercent} />}
    </HStack>
  );
  return (
    <Box as="figure" m="0" aria-label="Agent quota usage" aria-busy={loading}>
      <Stack gap="lg">
        {heading}
        {error && <Text color="fg.error">{error}</Text>}
        {selected && (
          <Grid
            key={selected.id}
            templateColumns={
              singleLimit ? "minmax(0, 1fr)" : { base: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }
            }
            gap="lg"
          >
            {selected.limits.map((limit) => (
              <QuotaHistoryChart
                key={limit.id}
                provider={selected.label}
                label={limit.label}
                header={
                  singleLimit ? undefined : (
                    <HStack justify="space-between" flexWrap="wrap">
                      <Text textStyle="paragraph/M/medium">{limit.label}</Text>
                      <QuotaUsageSummary remainingPercent={limit.remainingPercent} />
                    </HStack>
                  )
                }
                resetsAt={limit.resetsAt}
                {...quotaSeries(limit, selected.checkedAt)}
              />
            ))}
          </Grid>
        )}
      </Stack>
    </Box>
  );
};
