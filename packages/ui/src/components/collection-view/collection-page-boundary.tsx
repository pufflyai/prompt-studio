import { Box } from "@chakra-ui/react";
import { type ReactNode, useEffect, useEffectEvent, useRef } from "react";

interface CollectionPageBoundaryProps {
  loading?: boolean;
  placeholder: ReactNode;
  onLoadMore?: () => void;
  reservePlaceholderSpace?: boolean;
  loadingLabel?: string;
}

export const CollectionPageBoundary = (props: CollectionPageBoundaryProps) => {
  const { loading, onLoadMore, placeholder, reservePlaceholderSpace, loadingLabel = "Loading more items" } = props;
  const boundary = useRef<HTMLDivElement>(null);
  const canLoadMore = Boolean(onLoadMore);
  const loadMore = useEffectEvent(() => onLoadMore?.());

  useEffect(() => {
    if (!boundary.current || loading || !canLoadMore) return;
    // The implicit root accounts for clipping by both the column and the horizontally scrolling board.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    });
    observer.observe(boundary.current);
    return () => observer.disconnect();
  }, [canLoadMore, loading]);

  return (
    <Box
      position="relative"
      minH="1px"
      role={loading ? "status" : undefined}
      aria-label={loading ? loadingLabel : undefined}
    >
      <Box
        ref={boundary}
        aria-hidden="true"
        pointerEvents="none"
        position="absolute"
        bottom={reservePlaceholderSpace ? "100%" : "0"}
        insetInline="0"
        height="64px"
      />
      {(loading || reservePlaceholderSpace) && (
        <Box aria-hidden="true" visibility={loading ? undefined : "hidden"}>
          {placeholder}
        </Box>
      )}
    </Box>
  );
};
