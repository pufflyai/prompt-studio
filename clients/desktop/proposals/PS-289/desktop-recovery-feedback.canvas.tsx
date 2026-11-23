import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { EmptyState } from "@pstdio/ui";
import { useState } from "react";
import { CopyStartupDiagnosticsButton } from "../../src/renderer/copy-startup-diagnostics-button";

const RecoveryActionFeedback = () => {
  const [retry, setRetry] = useState<"idle" | "pending" | "failed">("idle");
  return (
    <Stack gap="md" minH="20rem">
      <Button variant="outline" alignSelf="center" disabled={retry !== "pending"} onClick={() => setRetry("failed")}>
        Fail pending retry
      </Button>
      <EmptyState title="Prompt Studio needs attention" description="Prompt Studio could not open its database safely.">
        <HStack gap="xs" flexWrap="wrap" justify="center">
          <Button loading={retry === "pending"} onClick={() => setRetry("pending")}>
            Retry
          </Button>
          <Button variant="outline">Open logs</Button>
          <CopyStartupDiagnosticsButton copyDiagnostics={async () => {}} />
          <Button variant="ghost">Quit</Button>
        </HStack>
        {retry === "failed" && (
          <Text role="alert" color="fg.error">
            The retry could not start. Try again.
          </Text>
        )}
      </EmptyState>
    </Stack>
  );
};
const meta = {
  title: "Proposals/PS-289 Desktop recovery action feedback",
  component: RecoveryActionFeedback,
} satisfies CanvasMeta<typeof RecoveryActionFeedback>;
export default meta;

export const DesktopRecoveryActions: CanvasFrame<typeof meta> = {
  id: "desktop-recovery-actions--pending",
};
