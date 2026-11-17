import { HStack, Stack, Text } from "@chakra-ui/react";
import type { ProjectSyncStatus } from "@pstdio/sdk/extensions";
import { AlertMessage, ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { syncPhaseLabel } from "./sync-phase";

export const SyncActivity = (props: { sync: ProjectSyncStatus; projectId?: string }) => {
  const { sync, projectId } = props;
  const { client, t } = useCloudContext();
  const [tab, setTab] = useState("files");
  const [retrying, setRetrying] = useState<string>();
  const [error, setError] = useState<string>();
  const sources = sync.sources ?? [];
  const files = sources.flatMap((source) => source.files.map((file) => ({ ...file, source })));
  const retry = async (sourceId: string) => {
    setRetrying(sourceId);
    setError(undefined);
    try {
      await client.account.retryProjectSyncSource(sourceId, projectId);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setRetrying(undefined);
    }
  };
  if (!sync.sources) return null;
  return (
    <Stack gap="sm">
      <HStack gap="xs">
        <Button size="sm" variant="outline" aria-pressed={tab === "files"} onClick={() => setTab("files")}>
          {t("activity.files", "Files")}
        </Button>
        <Button size="sm" variant="outline" aria-pressed={tab === "data"} onClick={() => setTab("data")}>
          {t("activity.data", "Project data")}
        </Button>
      </HStack>
      <ScrollArea maxH="sm">
        <Stack gap="sm">
          {tab === "files" ? (
            <>
              {!files.some((file) => file.direction === "download" && file.status === "active") && (
                <Text color="fg.muted">
                  {t("activity.noDownloads", "No files are downloading. Open Project data to see what is pending.")}
                </Text>
              )}
              {files.map((file) => (
                <Stack key={`${file.source.id}:${file.id}`} gap="xs">
                  <HStack justify="space-between">
                    <Text overflowWrap="anywhere">
                      {file.name ?? t("activity.unnamedFile", "File (name unavailable)")}
                    </Text>
                    <Text>
                      {t(`activity.file.${file.status}`, file.status[0]!.toUpperCase() + file.status.slice(1))}
                    </Text>
                  </HStack>
                  <Text color="fg.muted">
                    {file.source.name ?? file.source.id} ·{" "}
                    {file.direction === "download"
                      ? t("activity.download", "Cloud → This device")
                      : t("activity.upload", "This device → Cloud")}
                  </Text>
                  <Text color="fg.muted">
                    {t("activity.bytes", "{{completed}} of {{total}} encrypted bytes", {
                      completed: file.completedBytes,
                      total: file.totalBytes,
                    })}
                  </Text>
                </Stack>
              ))}
            </>
          ) : (
            sources.map((source) => (
              <Stack key={source.id} gap="xs">
                <HStack justify="space-between">
                  <Text>{source.name ?? source.id}</Text>
                  <Text>
                    {!source.connected
                      ? t("activity.offline", "Waiting for connection")
                      : t(`activity.phase.${source.phase}`, syncPhaseLabel(source.phase))}
                  </Text>
                </HStack>
                {source.download && (
                  <Text color="fg.muted">
                    {t("activity.documents", "{{completed}} internal sync documents ready · Total {{total}}", {
                      completed: source.download.completed,
                      total: source.download.total ?? t("activity.unknown", "not known yet"),
                    })}
                  </Text>
                )}
                {source.lastProgressAt && (
                  <Text color="fg.muted">
                    {t("activity.lastProgress", "Last progress: {{time}}", {
                      time: new Date(source.lastProgressAt).toLocaleString(),
                    })}
                  </Text>
                )}
                {source.startedAt && source.completedAt && (
                  <Text color="fg.muted">
                    {t("activity.elapsed", "Completed in {{seconds}} seconds", {
                      seconds: ((Date.parse(source.completedAt) - Date.parse(source.startedAt)) / 1000).toFixed(1),
                    })}
                  </Text>
                )}
                {source.error && <AlertMessage status="warning">{source.error}</AlertMessage>}
                {source.canRetry && (source.busy || source.error || !source.downloaded) && (
                  <Button
                    size="sm"
                    variant="outline"
                    alignSelf="flex-start"
                    disabled={!!retrying}
                    onClick={() => void retry(source.id)}
                  >
                    {retrying === source.id
                      ? t("activity.retrying", "Cancelling previous work before retry…")
                      : t("activity.retrySource", "Retry {{source}}", { source: source.name ?? source.id })}
                  </Button>
                )}
              </Stack>
            ))
          )}
        </Stack>
      </ScrollArea>
      {error && <AlertMessage status="error">{error}</AlertMessage>}
    </Stack>
  );
};
