import { Button, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, Switch } from "@pstdio/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";
import { SyncStatus } from "@/shared/cloud/sync-status";
import { cloudAccountKey, cloudProjectKey, useCloudAccount, useCloudProject } from "@/shared/cloud/use-cloud-account";

export const CloudProjectPanel = (props: { projectId?: string }) => {
  const { projectId } = props;
  const account = useCloudAccount();
  const status = useCloudProject(projectId);
  const client = useQueryClient();
  const update = useMutation({
    mutationFn: (cloud: boolean) =>
      cloud ? getApiClient().account.syncProject(projectId!) : getApiClient().account.stopProjectSync(projectId!),
    onSuccess: async () => {
      await Promise.all([cloudAccountKey, cloudProjectKey].map((queryKey) => client.invalidateQueries({ queryKey })));
    },
  });
  const cloud = !!projectId && !!account.data?.cloudProjects.includes(projectId);
  const error = update.error ?? account.error ?? status.error;
  return (
    <Stack gap="md" padding="lg">
      <Text textStyle="heading/S">Project sync</Text>
      <Switch
        checked={cloud}
        inputProps={{ checked: cloud }}
        disabled={
          !projectId || !account.data?.login || !account.data.cloudProjectsLoaded || update.isPending || account.isError
        }
        onCheckedChange={(event) => update.mutate(event.checked)}
      >
        Sync this project with Cloud
      </Switch>
      {!account.data?.login && (
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Sign in from Account and devices first.
        </Text>
      )}
      {account.data?.cloudProjectsLoaded === false && (
        <Text color="fg.muted">Waiting for the account service to confirm this project's Cloud setting.</Text>
      )}
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Turning this off stops project sync for every device. Each device keeps its local copy.
      </Text>
      {error && (
        <AlertMessage
          status="error"
          title="Project sync could not update"
          endElement={
            <Button
              onClick={() => {
                update.reset();
                void account.refetch();
                void status.refetch();
              }}
            >
              Try again
            </Button>
          }
        >
          {error.message}
        </AlertMessage>
      )}
      {projectId && (
        <SyncStatus
          state={status.isError ? "offline" : (status.data?.state ?? "first-download-incomplete")}
          onRetry={() => {
            void status.refetch();
          }}
        />
      )}
    </Stack>
  );
};
