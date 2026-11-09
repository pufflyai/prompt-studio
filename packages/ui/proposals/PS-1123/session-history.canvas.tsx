import { Box, Button, HStack, Spinner, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "../../src/components/primitives/scroll-area";
import { TreeList } from "../../src/components/tree-list/tree-list";

export default {
  title: "Proposals/PS-1123 Session history",
  description:
    "Older sessions append as the list reaches its end. A failed read retains history and offers Retry inline.",
};

export const History = () => {
  const [count, setCount] = useState(50);
  const [expanded, setExpanded] = useState(true);
  const [failure, setFailure] = useState(false);
  const [loading, setLoading] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const boundary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded || count >= 150 || failure || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setLoading(true);
      },
      { root: viewport.current },
    );
    if (boundary.current) observer.observe(boundary.current);
    return () => observer.disconnect();
  }, [expanded, count, failure, loading]);
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setCount((value) => Math.min(value + 50, 150));
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [loading]);
  return (
    <Box h="96" w="80" display="flex" flexDirection="column">
      <HStack flexShrink="0">
        <Button
          variant="ghost"
          onClick={() => {
            setCount(50);
            setFailure(false);
          }}
        >
          Reset
        </Button>
        <Button variant="ghost" onClick={() => setFailure(true)}>
          Fail next read
        </Button>
      </HStack>
      <ScrollArea flex="1" minH="0" viewportRef={viewport}>
        <TreeList
          sections={[
            {
              id: "sessions",
              label: "Sessions",
              nodes: Array.from({ length: count }, (_, i) => ({ id: `session-${i}`, label: `Session ${i + 1}` })),
            },
          ]}
          expandedSectionIds={expanded ? ["sessions"] : []}
          onToggleSection={() => setExpanded(!expanded)}
        />
        {expanded && count < 150 ? (
          <Box ref={boundary} minH="6" role="status">
            {failure ? (
              <HStack>
                <Text color="fg.error">Could not load older sessions.</Text>
                <Button onClick={() => setFailure(false)}>Retry</Button>
              </HStack>
            ) : null}
            {!failure && loading ? <Spinner size="xs" aria-label="Loading older sessions" /> : null}
          </Box>
        ) : null}
      </ScrollArea>
    </Box>
  );
};
