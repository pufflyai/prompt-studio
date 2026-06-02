import { Box, Button, Grid, Skeleton, Stack } from "@chakra-ui/react";
import { EmptyState } from "../empty-state";

interface DeferredDiffLoadProps {
  title: string;
  actionLabel?: string;
  isLoadingDiff: boolean;
  onAction?: () => void;
}

export const DeferredDiffLoad = (props: DeferredDiffLoadProps) => {
  const { title, actionLabel, isLoadingDiff, onAction } = props;

  return (
    <Box bg="bg" p="md" borderTop="1px solid" borderColor="border.muted">
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

const loadingRows = [
  { accent: "border.muted", width: "42%" },
  { accent: "fg.error", width: "62%" },
  { accent: "fg.success", width: "56%" },
  { accent: "border.muted", width: "74%" },
] as const;

interface LoadingDiffLineProps {
  accent: string;
  width: string;
}

const LoadingDiffLine = (props: LoadingDiffLineProps) => {
  const { accent, width } = props;

  return (
    <Grid
      h="18px"
      templateColumns="3px 40px minmax(0, 1fr)"
      alignItems="center"
      borderTop="1px solid"
      borderColor="border.subtle"
      bg="bg"
    >
      <Box h="full" bg={accent} opacity="0.65" />
      <Skeleton h="8px" w="18px" borderRadius="xs" justifySelf="center" />
      <Skeleton h="9px" w={width} maxW="full" borderRadius="xs" />
    </Grid>
  );
};

export const LoadingDiffContent = () => (
  <Stack
    h="88px"
    gap="0"
    bg="bg"
    borderTop="1px solid"
    borderColor="border.muted"
    overflow="hidden"
    role="status"
    aria-busy="true"
    aria-label="Loading diff"
  >
    <Grid h="16px" templateColumns="40px minmax(0, 1fr)" alignItems="center" px="xs" bg="bg.subtle">
      <Skeleton h="8px" w="22px" borderRadius="xs" />
      <Skeleton h="8px" w="34%" maxW="full" borderRadius="xs" />
    </Grid>
    {loadingRows.map((row, index) => (
      <LoadingDiffLine key={`${row.width}-${index}`} accent={row.accent} width={row.width} />
    ))}
  </Stack>
);

export const LoadingDiffCardSkeleton = () => (
  <Stack gap="0" border="1px solid" borderColor="border.muted" borderRadius="xs" overflow="hidden" bg="bg" width="100%">
    <Grid h="36px" templateColumns="28px minmax(0, 1fr) auto" alignItems="center" gap="sm" px="xs" bg="bg">
      <Skeleton h="14px" w="14px" borderRadius="xs" />
      <Skeleton h="10px" w="46%" maxW="full" borderRadius="xs" />
      <Skeleton h="16px" w="54px" borderRadius="xs" />
    </Grid>
    <LoadingDiffContent />
  </Stack>
);
