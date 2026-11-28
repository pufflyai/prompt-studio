import { Box } from "@chakra-ui/react";
import { type ReactNode, useEffect, useEffectEvent, useRef } from "react";

interface CollectionPageBoundaryProps {
  loading?: boolean;
  placeholder: ReactNode;
  onLoadMore: () => void;
}

export const CollectionPageBoundary = (props: CollectionPageBoundaryProps) => {
  const { loading, onLoadMore, placeholder } = props;
  const boundary = useRef<HTMLDivElement>(null);
  const loadMore = useEffectEvent(onLoadMore);

  useEffect(() => {
    if (!boundary.current || loading) return;
    // The implicit root accounts for clipping by both the column and the horizontally scrolling board.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    });
    observer.observe(boundary.current);
    return () => observer.disconnect();
  }, [loading]);

  return (
    <Box
      position="relative"
      minH="1px"
      role={loading ? "status" : undefined}
      aria-label={loading ? "Loading more items" : undefined}
    >
      <Box
        ref={boundary}
        aria-hidden="true"
        pointerEvents="none"
        position="absolute"
        bottom="0"
        insetInline="0"
        height="64px"
      />
      {loading && <Box aria-hidden="true">{placeholder}</Box>}
    </Box>
  );
};
