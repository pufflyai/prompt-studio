import { HStack, Stack } from "@chakra-ui/react";
import { createWebviewClient, type ProjectSyncStatus } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { Button } from "./button";
import { CloudContext } from "./cloud-context";
import { SyncActivity } from "./sync-activity";

export default { title: "Cloud/Sync activity", description: "Synthetic sources; retry never changes a project." };

const modes = ["Waiting", "Downloading", "Uploading", "Offline", "Synced"] as const;
export const DownloadDetails = () => {
  const [mode, setMode] = useState<(typeof modes)[number]>("Waiting");
  const active = mode === "Downloading" || mode === "Uploading";
  const sync: ProjectSyncStatus = {
    state: "first-download-incomplete",
    offlineReady: false,
    sources: [
      {
        id: "sessions",
        name: "Sessions",
        phase: active ? "receiving-records" : "record-stream:merge",
        connected: mode !== "Offline",
        busy: active,
        downloaded: mode === "Synced",
        canRetry: true,
        lastProgressAt: "2026-11-12T06:32:00Z",
        download: { completed: 2, total: mode === "Synced" ? 3 : null },
        files: active
          ? [
              {
                id: "draft",
                name: "draft-draft.json",
                direction: mode === "Uploading" ? "upload" : "download",
                status: "active",
                byteLength: 320,
                completedBytes: 32,
                totalBytes: 348,
              },
            ]
          : [],
      },
    ],
  };
  const client = createWebviewClient<Record<never, never>>({
    extensionId: "pstdio.pstdio-cloud",
    call: async <T,>() => {
      setMode("Downloading");
      return undefined as T;
    },
    onEvent: () => () => {},
  });
  return (
    <CloudContext
      value={{
        client,
        t: (key, fallback = key, values) =>
          fallback.replace(/\{\{(\w+)\}\}/g, (_match, key) => String(values?.[key] ?? key)),
      }}
    >
      <Stack p="md" gap="md">
        <HStack flexWrap="wrap" gap="xs">
          {modes.map((value) => (
            <Button
              key={value}
              size="sm"
              variant="outline"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {value}
            </Button>
          ))}
        </HStack>
        <SyncActivity sync={sync} projectId="synthetic" />
      </Stack>
    </CloudContext>
  );
};
