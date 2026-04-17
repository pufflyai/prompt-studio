import { Box, Stack } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import { type Diff, DiffCard } from "./diff-card";
import { EmptyState } from "./empty-state";
import { ScrollArea } from "./scroll-area";

interface DiffDrawerProps {
  diffs: Diff[];
  selectedDiffPath?: string | null;
}

export type { Diff };

const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";

export function DiffDrawer(props: DiffDrawerProps) {
  const { diffs, selectedDiffPath = null } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());

  const virtualizer = useVirtualizer({
    count: diffs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 42,
    overscan: 5,
  });

  useEffect(() => {
    if (!selectedDiffPath) return;

    const index = diffs.findIndex((diff) => getDiffPath(diff) === selectedDiffPath);
    if (index < 0) return;

    virtualizer.scrollToIndex(index, { align: "start" });
  }, [selectedDiffPath, diffs, virtualizer]);

  if (diffs.length === 0) {
    return (
      <Stack h="full" minH="0" gap="0">
        <ScrollArea flex="1" minH="0" contentProps={{ p: "xs", spaceY: "xs" }}>
          <EmptyState title="No changes detected" description="Make some changes to see the diff here." paddingY="sm" />
        </ScrollArea>
      </Stack>
    );
  }

  const toggleCollapsed = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <Stack h="full" minH="0" gap="0">
      <Box position="relative" flex="1" minH="0">
        <ScrollArea position="absolute" inset="0" viewportRef={scrollRef} contentProps={{ p: "xs" }}>
          <Box position="relative" width="100%" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
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
                  style={{ transform: `translateY(${virtualItem.start}px)` }}
                >
                  <DiffCard
                    diff={diff}
                    isSelected={selectedDiffPath === path}
                    isExpanded={!collapsedPaths.has(path)}
                    onToggleExpanded={() => toggleCollapsed(path)}
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
