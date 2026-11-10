import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ScopedMenu as Menu } from "@pstdio/ui";
import { useState } from "react";
import { quotaSeries } from "../quota-history";
import { quotaSelection } from "../quota-selection";
import type { QuotaReport } from "../quotas";
import { HomeIcon } from "./home-icon";
import { QuotaHistoryChart } from "./quota-history-chart";

interface QuotaGraphProps {
  providers: QuotaReport[];
  loading: boolean;
  error?: string;
}

export const QuotaGraph = (props: QuotaGraphProps) => {
  const { providers, loading, error } = props;
  const [selectedId, setSelectedId] = useState<string>();
  const { available, selected } = quotaSelection(providers, selectedId);
  if (!selected && !error) return null;
  return (
    <Box as="figure" m="0" aria-label="Agent quota usage" aria-busy={loading}>
      <Stack gap="lg">
        {selected && (
          <HStack justify="flex-end" minW="0">
            {available.length > 1 ? (
              <Menu.Root>
                <Menu.Trigger asChild>
                  <Button size="sm" variant="ghost" aria-label={`Quota harness: ${selected.label}`} maxW="full">
                    <HomeIcon name={selected.icon ?? "terminal"} />
                    <Text truncate>{selected.label}</Text>
                    <HomeIcon name="chevron-down" />
                  </Button>
                </Menu.Trigger>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.RadioItemGroup value={selected.id} onValueChange={({ value }) => setSelectedId(value)}>
                      {available.map((provider) => (
                        <Menu.RadioItem key={provider.id} value={provider.id}>
                          <HomeIcon name={provider.icon ?? "terminal"} />
                          <Menu.ItemText>{provider.label}</Menu.ItemText>
                          <Menu.ItemIndicator>
                            <HomeIcon name="check" />
                          </Menu.ItemIndicator>
                        </Menu.RadioItem>
                      ))}
                    </Menu.RadioItemGroup>
                  </Menu.Content>
                </Menu.Positioner>
              </Menu.Root>
            ) : (
              <HStack gap="sm" minW="0">
                <HomeIcon name={selected.icon ?? "terminal"} />
                <Text textStyle="paragraph/M/medium" truncate>
                  {selected.label}
                </Text>
              </HStack>
            )}
          </HStack>
        )}
        {error && <Text color="fg.error">{error}</Text>}
        {selected && (
          <Stack key={selected.id} gap="lg">
            {selected.limits.map((limit) => (
              <QuotaHistoryChart
                key={limit.id}
                provider={selected.label}
                label={limit.label}
                showLabel={selected.limits.length > 1}
                remainingPercent={limit.remainingPercent}
                resetsAt={limit.resetsAt}
                {...quotaSeries(limit, selected.checkedAt)}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};
