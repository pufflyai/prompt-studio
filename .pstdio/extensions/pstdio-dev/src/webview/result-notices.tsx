import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import type { ReleaseStatus } from "../benchmarks/analysis";
import { platformLabel } from "../benchmarks/platforms";

const when = (value: string) =>
  new Date(value).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

interface SyncFailedProps {
  error: string;
  syncedAt?: string;
  retrying: boolean;
  onRetry: () => void;
}

// Cached results stay readable; the notice says how fresh they are. Recovery sits in the alert footer.
export const SyncFailed = (props: SyncFailedProps) => (
  <AlertMessage
    status="error"
    title="Results could not be synced"
    endElement={
      <Button loading={props.retrying} onClick={props.onRetry}>
        Retry sync
      </Button>
    }
  >
    {props.error}{" "}
    {props.syncedAt
      ? `Showing results last synced ${when(props.syncedAt)}.`
      : "No sync has finished yet, so only results cached earlier show."}
  </AlertMessage>
);

const list = (platforms: string[]) => platforms.map(platformLabel).join(", ");

// A published release without results yet is named here instead of appearing as zero in the charts, and failed
// suites are named instead of leaving silent gaps.
export const ReleasePending = (props: { status: ReleaseStatus }) => {
  const { version, finished, running, missing, failed } = props.status;
  const sentences = [
    finished.length ? `${list(finished)} ${finished.length > 1 ? "have" : "has"} results.` : "",
    running.length ? `${list(running)} still running.` : "",
    missing.length ? `${list(missing)} ${missing.length > 1 ? "have" : "has"} no results.` : "",
    failed.length ? `Failed: ${failed.join(", ")}; their charts have no point for this release.` : "",
  ];
  let title = `${version} · some benchmarks failed`;
  if (missing.length) title = `${version} · benchmark results incomplete`;
  if (running.length) title = `${version} · benchmark results pending`;
  return (
    <AlertMessage status={running.length ? "info" : "warning"} title={title}>
      {sentences.filter(Boolean).join(" ")}{" "}
      {running.length
        ? "The release is published either way; its results appear in the charts when its benchmarks finish."
        : "Measure the release's tag from Runs to fill the gaps."}
    </AlertMessage>
  );
};
