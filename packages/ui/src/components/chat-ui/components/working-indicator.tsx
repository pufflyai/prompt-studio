import { HStack, Spinner, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

// Compact, unit-dropping elapsed format: "4s", "48s", "10m 20s", "1h 04m".
const formatElapsed = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
};

/**
 * Working indicator: a spinner followed by the elapsed run time in mono digits — never a
 * static "Working…" label. The elapsed time is the one thing a static label cannot tell you
 * and how you judge whether a run is stuck. Counts from mount (the start of the current run).
 */
export const WorkingIndicator = () => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedSeconds((Date.now() - startedAt) / 1000), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <HStack gap="2xs" px="sm" py="xs">
      <Spinner size="xs" color="fg.muted" />
      <Text fontFamily="mono" fontSize="xs" color="fg.muted" letterSpacing="-0.2px">
        {formatElapsed(elapsedSeconds)}
      </Text>
    </HStack>
  );
};
