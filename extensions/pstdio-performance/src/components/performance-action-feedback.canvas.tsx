import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { PerformancePopoverContent } from "./performance-popover-content";
import { smoothSnapshot } from "./performance-snapshot.fixtures";

const PerformanceActionFeedback = () => {
  const [confirmed, setConfirmed] = useState(false);
  const [requested, setRequested] = useState<boolean>();
  const [copying, setCopying] = useState(false);
  const [pendingExtensions, setPendingExtensions] = useState<ReadonlySet<string>>(new Set());

  return (
    <Stack gap="sm">
      <Button
        size="sm"
        onClick={() => {
          if (requested !== undefined) setConfirmed(requested);
          setRequested(undefined);
          setCopying(false);
          setPendingExtensions(new Set());
        }}
      >
        Finish pending actions
      </Button>
      <Box width="performance-popover" borderWidth="1px" borderColor="border" bg="bg">
        <PerformancePopoverContent
          snapshot={{ ...smoothSnapshot, pausedExtensionIds: ["installed-motion"] }}
          copying={copying}
          pendingExtensions={pendingExtensions}
          onCopy={() => setCopying(true)}
          onPause={(id) => setPendingExtensions(new Set([...pendingExtensions, id]))}
          onResume={(id) => setPendingExtensions(new Set([...pendingExtensions, id]))}
          onDismissActionError={() => {}}
          renderOverlay={{
            state: { supported: true, enabled: requested ?? confirmed, scope: "workbench" },
            pending: requested !== undefined,
            onEnabledChange: setRequested,
          }}
        />
      </Box>
    </Stack>
  );
};
const meta = {
  title: "Extensions/Performance/Pending actions",
  component: PerformanceActionFeedback,
} satisfies CanvasMeta<typeof PerformanceActionFeedback>;
export default meta;

export const PerformanceActionsPending: CanvasFrame<typeof meta> = {
  id: "extensions-performance--actions-pending",
};
