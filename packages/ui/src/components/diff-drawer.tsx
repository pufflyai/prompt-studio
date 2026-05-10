import { Box, Stack } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import { type Diff, DiffCard } from "./diff-card";
import { EmptyState } from "./empty-state";
import { ScrollArea } from "./scroll-area";

interface DiffDrawerProps {
  diffs: Diff[];
  selectedDiffPath?: string | null;
  onLoadDiff?: (path: string) => Promise<void>;
}

export type { Diff };

const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";

export const buildInitialExpandedPaths = (diffs: Diff[], selectedDiffPath: string | null) => {
  if (!selectedDiffPath || !diffs.some((diff) => getDiffPath(diff) === selectedDiffPath)) {
    return new Set<string>();
  }

  return new Set([selectedDiffPath]);
};

export function DiffDrawer(props: DiffDrawerProps) {
  const { diffs, selectedDiffPath = null, onLoadDiff } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() =>
    buildInitialExpandedPaths(diffs, selectedDiffPath),
  );
  const [largeDiffOptInPaths, setLargeDiffOptInPaths] = useState<Set<string>>(() => new Set());

  const virtualizer = useVirtualizer({
    count: diffs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 112,
    overscan: 5,
  });

  useEffect(() => {
    if (!selectedDiffPath) return;

    const index = diffs.findIndex((diff) => getDiffPath(diff) === selectedDiffPath);
    if (index < 0) return;

    virtualizer.scrollToIndex(index, { align: "start" });
  }, [selectedDiffPath, diffs, virtualizer]);

  useEffect(() => {
    if (!selectedDiffPath) return;

    setExpandedPaths((prev) => new Set(prev).add(selectedDiffPath));
  }, [selectedDiffPath]);

  if (diffs.length === 0) {
    return (
      <Stack h="full" minH="0" gap="0">
        <ScrollArea flex="1" minH="0" contentProps={{ p: "xs", spaceY: "xs" }}>
          <EmptyState title="No changes detected" description="Make some changes to see the diff here." paddingY="sm" />
        </ScrollArea>
      </Stack>
    );
  }

  const toggleExpanded = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const showFullDiff = (path: string) => {
    setLargeDiffOptInPaths((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  };

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <Stack h="full" minH="0" gap="0">
      <Box position="relative" flex="1" minH="0">
        <ScrollArea position="absolute" inset="0" viewportRef={scrollRef} contentProps={{ p: "xs" }}>
          <Box position="relative" width="100%" style={{ height: virtualizer.getTotalSize() }}>
            {virtualItems.map((virtualItem) => {
              const diff = diffs[virtualItem.index];
              const path = getDiffPath(diff);

              return (
                <Box
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  position="absolute"
                  top="0"
                  left="0"
                  width="100%"
                  pb="xs"
                  style={{ top: virtualItem.start }}
                >
                  <DiffCard
                    key={path}
                    diff={diff}
                    isSelected={selectedDiffPath === path}
                    isExpanded={expandedPaths.has(path)}
                    onToggleExpanded={() => toggleExpanded(path)}
                    onLoadDiff={onLoadDiff}
                    hasOptedIntoLargeDiff={largeDiffOptInPaths.has(path)}
                    onShowFullDiff={() => showFullDiff(path)}
                  />
                </Box>
              );
            })}
          </Box>
        </ScrollArea>
      </Box>
    </Stack>
  );
}
