import { workbenchCommands } from "@pstdio/sdk/extensions";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import type { useCloud } from "./use-cloud";

type CloudData = NonNullable<ReturnType<typeof useCloud>["data"]>;

export const CloudProjectRecovery = (props: { data: CloudData; refresh(): void }) => {
  const { data, refresh } = props;
  const { client, t } = useCloudContext();
  const [error, setError] = useState<string>();
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    setError(undefined);
    try {
      await client.navigation.open({
        kind: "command",
        target: { command: workbenchCommands.retryProjectSetup },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRetrying(false);
      refresh();
    }
  };
  const needsRetry =
    data.project?.state !== "ready" ||
    ["offline", "needs-attention", "first-download-incomplete"].includes(data.sync.state);
  return (
    <>
      {needsRetry && (
        <Button size="sm" variant="outline" alignSelf="flex-start" loading={retrying} onClick={() => void retry()}>
          {t("actions.retry", "Retry")}
        </Button>
      )}
      {needsRetry && error && <AlertMessage status="error">{error}</AlertMessage>}
    </>
  );
};
