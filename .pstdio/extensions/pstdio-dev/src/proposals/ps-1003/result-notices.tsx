import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";

interface SyncFailedProps {
  lastSynced: string;
  onRetry: () => void;
}

// Cached results stay readable; the notice says how fresh they are. Recovery sits in the alert footer.
export const SyncFailed = (props: SyncFailedProps) => (
  <AlertMessage
    status="error"
    title="Results could not be synced"
    endElement={<Button onClick={props.onRetry}>Retry sync</Button>}
  >
    GitHub could not be reached. Showing results last synced {props.lastSynced}.
  </AlertMessage>
);

interface ReleasePendingProps {
  version: string;
  finished: string[];
  running: string[];
}

// A published release without results yet is named here instead of appearing as zero in the charts.
export const ReleasePending = (props: ReleasePendingProps) => (
  <AlertMessage status="info" title={`${props.version} · benchmark results pending`}>
    {props.finished.join(", ")} finished. {props.running.join(", ")} still running. The release is published either way;
    its results appear in the charts when the benchmarks finish.
  </AlertMessage>
);
