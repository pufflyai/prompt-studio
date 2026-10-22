import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { SessionHarnessUnavailable } from "./session-harness-unavailable";
import { SessionPersonalDevice } from "./session-personal-device";

interface SessionComposerFallbackProps {
  input: Pick<WorkbenchPanelRenderInput, "workbench">;
  deviceName?: string;
  onInterrupt?: () => void;
}

// A session from another device is read-only here; otherwise no harness can continue it.
export const SessionComposerFallback = (props: SessionComposerFallbackProps) => {
  const { input, deviceName, onInterrupt } = props;
  if (deviceName) return <SessionPersonalDevice name={deviceName} />;
  const reviewExtensions = () =>
    void input.workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "extensions" });
  return <SessionHarnessUnavailable onInterrupt={onInterrupt} onReviewExtensions={reviewExtensions} />;
};
