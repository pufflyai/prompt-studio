import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { quotaSeries } from "../quota-history";
import type { QuotaReport } from "../quotas";
import { QuotaHistoryChart } from "./quota-history-chart";

interface QuotaGraphProps {
  providers: QuotaReport[];
  loading: boolean;
  error?: string;
  onRefresh(): void;
}

export const QuotaGraph = (props: QuotaGraphProps) => {
  const { providers, loading, error, onRefresh } = props;
  const available = providers.filter((provider) => provider.status === "available" && provider.limits.length > 0);
  if (!available.length && !error) return null;
  return (
    <Box as="figure" m="0" aria-label="Remaining agent quotas">
      <Stack gap="lg">
        <HStack justify="space-between">
          <Text as="figcaption" textStyle="heading/S">
            Agent quotas
          </Text>
          <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading}>
            {loading ? "Checking…" : "Refresh"}
          </Button>
        </HStack>
        {error && <Text color="fg.error">{error}</Text>}
        {available.map((provider) => (
          <Stack key={provider.id} gap="sm">
            <HStack justify="space-between" flexWrap="wrap">
              <Text textStyle="paragraph/M/medium">{provider.label}</Text>
              <Text color="fg.muted" textStyle="paragraph/S/regular">
                Checked {new Date(provider.checkedAt).toLocaleTimeString()}
              </Text>
            </HStack>
            {provider.limits.map((limit) => (
              <QuotaHistoryChart
                key={limit.id}
                provider={provider.label}
                label={limit.label}
                remainingPercent={limit.remainingPercent}
                resetsAt={limit.resetsAt}
                {...quotaSeries(limit, provider.checkedAt)}
              />
            ))}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
};
