import { Fieldset, Flex, Skeleton, Stack } from "@chakra-ui/react";
import { type HostStorage, HostStorageProvider } from "@pstdio/ui";
import { AutoBuildButton } from "./auto-build-button";
import { PlanHeader } from "./plan-header";

// Loading controls must never initialize or overwrite the person's saved view.
const loadingStorage: HostStorage = { getItem: () => null, setItem: () => {} };
const loadingData = { storageKey: "planner-timeline-loading", attributes: [], rows: [] };

interface PlanLoadingProps {
  t: (key: string, fallback?: string) => string;
}

export function PlanLoading(props: PlanLoadingProps) {
  const { t } = props;
  return (
    <Flex direction="column" h="full" minH="0" minW="0">
      <Fieldset.Root disabled border="0" p="0" m="0" minW="0">
        <HostStorageProvider storage={loadingStorage}>
          <PlanHeader
            data={loadingData}
            search=""
            onSearchChange={() => {}}
            resultLabel=""
            actions={
              <AutoBuildButton
                disabled
                enabled={false}
                sessions={[]}
                running={0}
                capacity={0}
                onConfigure={() => {}}
                onOpenSession={() => {}}
                onTurnOff={async () => false}
                t={t}
              />
            }
          />
        </HostStorageProvider>
      </Fieldset.Root>
      <Flex
        role="region"
        aria-label={t("timeline.loading", "Loading timeline")}
        aria-busy="true"
        flex="1"
        minH="0"
        overflow="hidden"
        p="md"
        gap="lg"
      >
        <Stack aria-hidden="true" w="20" flexShrink="0" gap="2xl">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} h="3" w="full" borderRadius="xs" />
          ))}
        </Stack>
        <Flex aria-hidden="true" flex="1" minW="0" gap="lg">
          {[0, 1, 2].map((column) => (
            <Stack key={column} flex="1" minW="64" gap="md">
              <Skeleton h="4" w="32" borderRadius="xs" />
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} h="28" w="full" borderRadius="xs" />
              ))}
            </Stack>
          ))}
        </Flex>
      </Flex>
    </Flex>
  );
}
