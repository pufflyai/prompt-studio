import { Spinner } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";

export const FrameLoading = (props: { name: string }) => {
  const { name } = props;
  return (
    <EmptyState
      data-ui-canvas-loading
      role="status"
      aria-live="polite"
      title={`Loading ${name}`}
      description="Preparing the interactive preview…"
      icon={<Spinner size="lg" color="fg.muted" />}
      p="lg"
    />
  );
};
