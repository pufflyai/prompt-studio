import { Button, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { type CloudProjectDeletion, type ProjectCopyAccount, PstdioApiError } from "@pstdio/sdk/client";
import { AlertMessage, DeleteConfirmationModal } from "@pstdio/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api";
import { cloudProjectCatalogKey } from "../data/project-catalog";

interface DeletionProps {
  id: string;
  name: string;
  account?: ProjectCopyAccount;
  receipt?: CloudProjectDeletion;
  canDelete: boolean;
  cloudOnly?: boolean;
  onSubmitted?: () => void;
  onCompleted?: () => void;
}

const deletionLabels: Record<CloudProjectDeletion["state"], string> = {
  completed: "Cloud project deleted",
  "needs-attention": "Cloud deletion needs attention",
  deleting: "Deleting cloud project",
};

const DeletionProgress = ({
  state,
  error,
  canRetry,
  retrying,
  onRetry,
}: {
  state?: CloudProjectDeletion["state"];
  error?: string;
  canRetry: boolean;
  retrying: boolean;
  onRetry: () => void;
}) => (
  <Stack gap="sm">
    <HStack role="status" gap="sm">
      {state !== "completed" && state !== "needs-attention" && <Spinner size="sm" />}
      <Text>{state ? deletionLabels[state] : "Checking whether Cloud deletion started"}</Text>
    </HStack>
    {error && (
      <AlertMessage status="error" compact role="alert">
        {error}
      </AlertMessage>
    )}
    {canRetry && (
      <Button size="sm" variant="outline" alignSelf="start" loading={retrying} onClick={onRetry}>
        Retry
      </Button>
    )}
  </Stack>
);

const useObservedDeletion = (account?: ProjectCopyAccount, receipt?: CloudProjectDeletion) => {
  const [observed, setObserved] = useState<{ account: ProjectCopyAccount; receipt: CloudProjectDeletion }>();
  useEffect(() => {
    if (account && receipt) setObserved({ account, receipt });
  }, [account, receipt]);
  return observed;
};

const useDeletionCompletion = (completed: boolean, onCompleted?: () => void) => {
  useEffect(() => {
    if (completed) onCompleted?.();
  }, [completed, onCompleted]);
};

const useCloudDeletion = ({ id, account, receipt, onSubmitted, onCompleted }: DeletionProps) => {
  const observed = useObservedDeletion(account, receipt);
  const [submittedAccount, setSubmittedAccount] = useState<ProjectCopyAccount>();
  const [started, setStarted] = useState<CloudProjectDeletion>();
  const [uncertain, setUncertain] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string>();
  const queryClient = useQueryClient();
  const refreshCatalog = () => queryClient.invalidateQueries({ queryKey: cloudProjectCatalogKey });

  const expected = submittedAccount ?? observed?.account ?? account;
  const accountMatches = Boolean(
    expected && account?.managerOrigin === expected.managerOrigin && account.accountId === expected.accountId,
  );
  const operation = useQuery({
    queryKey: ["project-cloud-deletion", expected?.managerOrigin, expected?.accountId, id],
    queryFn: ({ signal }) => getApiClient().account.projectDeletionStatus(id, { signal, expected }),
    enabled: accountMatches && Boolean(started ?? receipt ?? observed?.receipt ?? uncertain),
    retry: false,
    refetchInterval: ({ state }) => (state.data?.state === "completed" ? false : 2000),
  });
  const latest = started?.state === "completed" ? started : (operation.data ?? started ?? receipt ?? observed?.receipt);
  const current = accountMatches ? latest : undefined;
  useDeletionCompletion(current?.state === "completed", onCompleted);

  const submit = async (expectedAccount: ProjectCopyAccount) => {
    setSubmittedAccount(expectedAccount);
    setError(undefined);
    onSubmitted?.();
    try {
      const result = await getApiClient().account.deleteCloudProject(id, { confirm: true, expectedAccount });
      setStarted(result);
      setUncertain(false);
      if (operation.data && operation.data.state !== result.state) await operation.refetch();
    } catch (failure) {
      setUncertain(true);
      setError(failure instanceof Error ? failure.message : "Cloud deletion could not be confirmed.");
    } finally {
      void refreshCatalog();
    }
  };

  const retry = async () => {
    if (!expected) return;
    setRetrying(true);
    try {
      await submit(expected);
    } finally {
      setRetrying(false);
    }
  };

  return { current, uncertain, error, retrying, operation, accountMatches, retry, submit };
};

export const CloudProjectDeletionAction = ({
  id,
  name,
  account,
  receipt,
  canDelete,
  cloudOnly,
  onSubmitted,
  onCompleted,
}: DeletionProps) => {
  const [confirmation, setConfirmation] = useState<ProjectCopyAccount>();
  const { current, uncertain, error, retrying, operation, accountMatches, retry, submit } = useCloudDeletion({
    id,
    name,
    account,
    receipt,
    canDelete,
    cloudOnly,
    onSubmitted,
    onCompleted,
  });

  if (accountMatches && (current || uncertain)) {
    const state = current?.state;
    const canResubmit =
      state === "needs-attention" ||
      (!state && uncertain && canDelete && operation.error instanceof PstdioApiError && operation.error.status === 404);
    const failure =
      operation.error?.message ??
      (current ? undefined : error) ??
      (state === "needs-attention" ? "Cloud cleanup has paused. Retry to resume the same operation." : undefined);
    return (
      <DeletionProgress
        state={state}
        error={state === "completed" ? undefined : failure}
        canRetry={canResubmit || operation.isError}
        retrying={retrying}
        onRetry={
          canResubmit
            ? retry
            : () => {
                void operation.refetch();
              }
        }
      />
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        disabled={!canDelete || !account}
        onClick={() => setConfirmation(account)}
      >
        Delete cloud project
      </Button>
      <DeleteConfirmationModal
        open={Boolean(confirmation)}
        onClose={() => setConfirmation(undefined)}
        onDelete={() => confirmation && submit(confirmation)}
        confirmDisabled={!canDelete || !account}
        headline={`Delete cloud project “${name}”?`}
        notificationText="Cloud data, files, history, recovery data, and project encryption keys will be permanently deleted. Downloaded copies stay as local projects, including unsynced work. Offline devices stop syncing when they reconnect. User-selected source folders stay on disk."
        buttonText="Delete cloud project"
      >
        {cloudOnly && <Text>This Cloud only entry will disappear after cleanup completes.</Text>}
      </DeleteConfirmationModal>
    </>
  );
};
