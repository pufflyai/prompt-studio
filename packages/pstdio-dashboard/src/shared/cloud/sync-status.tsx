import { Button, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import type { ProjectSyncState } from "@pstdio/sdk/client";

export const syncLabels: Record<ProjectSyncState, string> = {
  "saved-locally": "Saved locally",
  "waiting-to-sync": "Waiting to sync",
  synced: "Synced",
  offline: "Offline",
  "first-download-incomplete": "First download incomplete",
  "needs-attention": "Needs attention",
};
const descriptions: Record<ProjectSyncState, string> = {
  "saved-locally": "Saved changes are on this device. This project is local only.",
  "waiting-to-sync": "Your changes are saved on this device and waiting to reach Cloud.",
  synced: "All known documents and required files have downloaded. Saved changes have reached Cloud.",
  offline: "The Cloud connection is offline. Keep working locally. Sync resumes when the connection returns.",
  "first-download-incomplete":
    "Some documents or files are still missing. This project is not ready offline. Download resumes when the connection returns.",
  "needs-attention":
    "Some synced data could not be read. Healthy updates continue. Check your account and service, then retry.",
};
interface SyncStatusProps {
  state: ProjectSyncState;
  onSettings?: () => void;
  onRetry?: () => void;
}
export const SyncStatus = (props: SyncStatusProps) => {
  const { state, onSettings, onRetry } = props;
  const warning = ["offline", "first-download-incomplete", "needs-attention"].includes(state);
  return (
    <Popover.Root positioning={{ placement: "top-end" }}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="2xs"
          color={warning ? "fg.warning" : "fg.muted"}
          aria-label={`Project sync: ${syncLabels[state]}`}
        >
          {syncLabels[state]}
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Body>
              <Stack gap="sm">
                <Text textStyle="label/M/medium">{syncLabels[state]}</Text>
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  {descriptions[state]}
                </Text>
                {onRetry && (
                  <Button variant="outline" size="sm" onClick={onRetry}>
                    Check again
                  </Button>
                )}
                {onSettings && (
                  <Button variant="ghost" size="sm" onClick={onSettings}>
                    Account and devices
                  </Button>
                )}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
