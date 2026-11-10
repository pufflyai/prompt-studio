import { Box, Button, HStack, Progress, Stack, Text } from "@chakra-ui/react";

import type { QuotaReport } from "../quotas";

interface QuotaGraphProps {
  providers: QuotaReport[];
  loading: boolean;
  error?: string;
  onRefresh(): void;
}

export const QuotaGraph = (props: QuotaGraphProps) => {
  const { providers, loading, error, onRefresh } = props;
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
        {!loading && !error && providers.length === 0 && <Text color="fg.muted">No quota commands available.</Text>}
        {providers.map((provider) => (
          <Stack key={provider.id} gap="sm">
            <HStack justify="space-between" flexWrap="wrap">
              <Text textStyle="paragraph/M/medium">{provider.label}</Text>
              <Text color="fg.muted" textStyle="paragraph/S/regular">
                Checked {new Date(provider.checkedAt).toLocaleTimeString()}
              </Text>
            </HStack>
            {provider.status !== "available" && (
              <Text color="fg.muted">{provider.message ?? "Quota unavailable."}</Text>
            )}
            {provider.limits.map((limit) => (
              <Progress.Root
                key={limit.id}
                value={limit.remainingPercent}
                max={100}
                colorPalette="blue"
                aria-label={`${provider.label} ${limit.label} remaining quota`}
              >
                <Stack gap="xs">
                  <HStack justify="space-between">
                    <Progress.Label>{limit.label}</Progress.Label>
                    <Text>{Math.round(limit.remainingPercent)}% remaining</Text>
                  </HStack>
                  <Progress.Track h="xs">
                    <Progress.Range />
                  </Progress.Track>
                  {limit.resetsAt && (
                    <Text color="fg.muted" textStyle="paragraph/S/regular">
                      Resets {new Date(limit.resetsAt).toLocaleString()}
                    </Text>
                  )}
                </Stack>
              </Progress.Root>
            ))}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
};
