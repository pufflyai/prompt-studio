import { Box, Spinner } from "@chakra-ui/react";
import { useEffect, useRef } from "react";

interface CollectionPageBoundaryProps {
  loading?: boolean;
  onLoadMore: () => void;
}

export const CollectionPageBoundary = (props: CollectionPageBoundaryProps) => {
  const { loading, onLoadMore } = props;
  const boundary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boundary.current || loading) return;
    // The implicit root accounts for clipping by both the column and the horizontally scrolling board.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)) onLoadMore();
    });
    observer.observe(boundary.current);
    return () => observer.disconnect();
  }, [loading, onLoadMore]);

  return (
    <Box position="relative" minH="1px" role="status">
      <Box
        ref={boundary}
        aria-hidden="true"
        pointerEvents="none"
        position="absolute"
        bottom="0"
        insetInline="0"
        height="64px"
      />
      {loading && <Spinner size="xs" aria-label="Loading more items" />}
    </Box>
  );
};
