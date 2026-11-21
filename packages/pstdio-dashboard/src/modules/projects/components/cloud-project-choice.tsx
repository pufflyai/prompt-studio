import { Button, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { CloudProjectDeletionAction } from "./cloud-project-deletion";
import { LocalProjectRemoval } from "./local-project-removal";
import { useCloudProjectChoice } from "./use-cloud-project-choice";

export const CloudProjectChoice = ({ input }: { input: WorkbenchPanelRenderInput }) => {
  const {
    id,
    name,
    entry,
    receipt,
    account,
    scope,
    deleting,
    downloading,
    download,
    sync,
    refresh,
    setDeletionScope,
    back,
    backButton,
    failure,
    showProgress,
    showDownload,
    invalidated,
    requestDownload,
  } = useCloudProjectChoice(input);

  if (invalidated) return null;

  return (
    <Stack gap="md" p="md">
      <Text as="h2" textStyle="heading/M">
        {name}
      </Text>
      {showProgress && (
        <HStack role="status">
          <Spinner size="sm" />
          <Text>{sync.data?.offlineReady ? "Preparing project folder" : "Downloading project"}</Text>
        </HStack>
      )}
      {!downloading && entry?.presence === "cloud-only" && <Text>Cloud only</Text>}
      {entry?.presence === "removing" && <Text>Local removal needs attention.</Text>}
      {entry && !entry.online && <Text color="fg.muted">Connect to Cloud to download or delete this project.</Text>}
      {failure && (
        <AlertMessage status="error" compact role="alert">
          {failure}
        </AlertMessage>
      )}
      <HStack gap="sm" justify="space-between" align="start" flexWrap="wrap">
        <Stack gap="sm">
          {entry?.presence === "removing" && (
            <LocalProjectRemoval id={id} name={name} account={account} pending onRemoved={() => void refresh()} />
          )}
          {(deleting || receipt || entry?.presence === "cloud-only") && (
            <CloudProjectDeletionAction
              id={id}
              name={name}
              account={account}
              receipt={receipt}
              canDelete={Boolean(entry?.actions.deleteCloud)}
              cloudOnly
              key={scope}
              onSubmitted={() => setDeletionScope(scope)}
              onCompleted={back}
            />
          )}
        </Stack>
        <HStack gap="sm">
          <Button ref={backButton} variant="ghost" size="sm" onClick={back}>
            Back
          </Button>
          {showDownload && (
            <Button
              size="sm"
              disabled={!entry?.actions.download || (!downloading && download.isPending)}
              loading={download.isPending}
              onClick={requestDownload}
            >
              {downloading || download.error ? "Retry" : "Download"}
            </Button>
          )}
        </HStack>
      </HStack>
    </Stack>
  );
};
