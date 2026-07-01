import { Box, Button, Skeleton, Stack } from "@chakra-ui/react";
import { EmptyState } from "@/components/primitives/empty-state";

interface DeferredDiffLoadProps {
  title: string;
  actionLabel?: string;
  isLoadingDiff: boolean;
  onAction?: () => void;
}

export const DeferredDiffLoad = (props: DeferredDiffLoadProps) => {
  const { title, actionLabel, isLoadingDiff, onAction } = props;

  return (
    <Box bg="bg" p="md" borderTop="1px solid" borderColor="border.subtle">
      <EmptyState title={title} paddingY="sm">
        {actionLabel ? (
          <Button size="xs" variant="outline" loading={isLoadingDiff} onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </EmptyState>
    </Box>
  );
};

const loadingDiffContentRows = ["first", "second", "third"] as const;

export const LoadingDiffContent = () => (
  <Stack
    h="280px"
    bg="bg"
    borderTop="1px solid"
    borderColor="border.subtle"
    p="xs"
    gap="2xs"
    role="status"
    aria-busy="true"
    aria-label="Loading diff"
  >
    {loadingDiffContentRows.map((row) => (
      <Skeleton key={row} h="20px" w="full" borderRadius="xs" />
    ))}
  </Stack>
);
