import { Box, Button, Text } from "@chakra-ui/react";
import { EmptyState } from "./empty-state";

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

export const LoadingDiffContent = () => (
  <Box bg="bg" p="sm" borderTop="1px solid" borderColor="border.muted">
    <Text textStyle="sm" color="fg.muted">
      Loading diff...
    </Text>
  </Box>
);
