import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { DesktopLifecycleView } from "./desktop-lifecycle-app";

const RecoveryActionFeedback = () => {
  const [current, setCurrent] = useState<ReturnType<typeof Promise.withResolvers<void>>>();

  return (
    <Stack gap="md" minH="20rem">
      <Button variant="outline" alignSelf="center" disabled={!current} onClick={() => current?.reject()}>
        Fail pending retry
      </Button>
      <DesktopLifecycleView
        state={{
          kind: "recovery",
          error: {
            code: "pglite_recovery_failure",
            message: "Prompt Studio could not open its database safely.",
            actions: ["retry", "open_logs", "quit"],
          },
        }}
        actions={{
          copyDiagnostics: async () => {},
          openLogs: async () => {},
          quitApp: async () => {},
          retryRuntime() {
            const result = Promise.withResolvers<void>();
            setCurrent(result);
            return result.promise.finally(() => setCurrent(undefined));
          },
        }}
      />
    </Stack>
  );
};
const meta = {
  title: "Product/Desktop/Recovery action feedback",
  component: RecoveryActionFeedback,
} satisfies CanvasMeta<typeof RecoveryActionFeedback>;
export default meta;

export const DesktopRecoveryActions: CanvasFrame<typeof meta> = {
  id: "desktop-recovery-actions--pending",
};
