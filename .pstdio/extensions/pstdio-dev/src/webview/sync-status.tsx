import { Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import type { useSyncOnOpen } from "./use-sync";

interface SyncStatusProps {
  sync: ReturnType<typeof useSyncOnOpen>;
}

// A failed sync keeps the cached results on screen and explains the problem beside them.
export const SyncStatus = (props: SyncStatusProps) => {
  const { sync } = props;
  if (sync.isPending)
    return (
      <Text textStyle="label/S/regular" color="fg.muted">
        Checking GitHub for new results…
      </Text>
    );
  if (sync.error)
    return (
      <AlertMessage status="warning" title="Showing cached results">
        {sync.error.message}
      </AlertMessage>
    );
  return null;
};
