import { Box, HStack, Spinner, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useConversationBottom } from "./use-conversation-bottom";

// Compact, unit-dropping elapsed format: "4s", "48s", "10m 20s", "1h 04m".
const formatElapsed = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
};

interface WorkingIndicatorProps {
  startedAt?: number;
  hidden?: boolean;
  workspaceContainer?: HTMLElement | null;
}

// Keep the clock mounted while its content moves between the transcript and workspace header.
export const WorkingIndicator = (props: WorkingIndicatorProps) => {
  const { startedAt, hidden = false, workspaceContainer } = props;
  const atBottom = useConversationBottom();
  const [mountedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (hidden) return;

    const updateElapsed = () => setNow(Date.now());
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [hidden]);

  if (hidden) return null;

  const indicator = (
    <HStack role="status" aria-label="Agent working" aria-live="off" gap="2xs" px="xs" py="2xs" flexShrink="0">
      <Spinner size="xs" color="fg.info" />
      <Text textStyle="label/XS/regular" color="fg.muted">
        Working
      </Text>
      <Text fontFamily="mono" textStyle="mono/XS" color="fg.muted" letterSpacing="-0.2px">
        {formatElapsed((now - (startedAt ?? mountedAt)) / 1000)}
      </Text>
    </HStack>
  );

  // Reserve the same space in both positions so relocating the indicator cannot move the scroll boundary.
  return <Box h="7">{atBottom || !workspaceContainer ? indicator : createPortal(indicator, workspaceContainer)}</Box>;
};
