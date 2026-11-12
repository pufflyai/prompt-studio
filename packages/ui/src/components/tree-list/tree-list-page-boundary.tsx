import { Box, Button, HStack, Spinner, Text } from "@chakra-ui/react";
import { useEffect, useRef } from "react";

export interface TreeListPagination {
  loading?: boolean;
  error?: string;
  loadMore(): void;
}

/** The virtualizer also mounts overscan rows; fetch only once this boundary enters the visible viewport. */
export const TreeListPageBoundary = (props: { pagination: TreeListPagination }) => {
  const { pagination } = props;
  const boundary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!boundary.current || pagination.loading || pagination.error) return;
    const root = boundary.current.closest('[data-scope="scroll-area"][data-part="viewport"]');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)) pagination.loadMore();
      },
      { root, rootMargin: "0px 0px 64px 0px" },
    );
    observer.observe(boundary.current);
    return () => observer.disconnect();
  }, [pagination]);
  return (
    <Box ref={boundary} minH="6" role="status" aria-live="polite">
      {pagination.loading ? <Spinner size="xs" aria-label="Loading more items" /> : null}
      {pagination.error ? (
        <HStack gap="xs">
          <Text color="fg.error" textStyle="label/XS">
            {pagination.error}
          </Text>
          <Button variant="ghost" size="xs" onClick={pagination.loadMore}>
            Retry
          </Button>
        </HStack>
      ) : null}
    </Box>
  );
};
