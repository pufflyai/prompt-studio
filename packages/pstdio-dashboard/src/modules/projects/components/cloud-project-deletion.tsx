import { Button, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { type CloudProjectDeletion, type ProjectCopyAccount, PstdioApiError } from "@pstdio/sdk/client";
import { AlertMessage, DeleteConfirmationModal } from "@pstdio/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useCloudProjectDeletions } from "../data/cloud-project-deletion-operations";
import { cloudProjectCatalogKey, cloudProjectDeletionKey } from "../data/project-catalog";

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

const useCloudDeletion = ({ id, name, account, receipt, onSubmitted, onCompleted }: DeletionProps) => {
  const observed = useObservedDeletion(account, receipt);
  const [submittedAccount, setSubmittedAccount] = useState<ProjectCopyAccount>();
  const [started, setStarted] = useState<CloudProjectDeletion>();
  const [uncertain, setUncertain] = useState(false);
  const deletions = useCloudProjectDeletions();
  const active = deletions.active(id);
  const checking = active?.status === "unknown" || active?.status === "unconfirmed";
  const writing = Boolean(active && !checking);
  const checked = useRef<symbol>(undefined);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string>();
  const queryClient = useQueryClient();
  const refreshCatalog = () => queryClient.invalidateQueries({ queryKey: cloudProjectCatalogKey });

  const expected = submittedAccount ?? observed?.account ?? account;
  const accountMatches = Boolean(
    expected && account?.managerOrigin === expected.managerOrigin && account.accountId === expected.accountId,
  );
  const operation = useQuery({
    queryKey: cloudProjectDeletionKey(id, expected),
    queryFn: ({ signal }) => deletions.read(id, expected, signal),
    enabled: accountMatches && Boolean(started || receipt || observed?.receipt || uncertain || checking),
    retry: false,
    refetchInterval: ({ state }) => (state.data?.state === "completed" ? false : 2000),
  });
  const latest = started?.state === "completed" ? started : (operation.data ?? started ?? receipt ?? observed?.receipt);
  const current = accountMatches ? latest : undefined;
  useDeletionCompletion(current?.state === "completed", onCompleted);
  useEffect(() => {
    if (!current || !active || !checking || checked.current === active.id) return;
    checked.current = active.id;
    void deletions.check(active.id);
  }, [active, checking, current, deletions]);

  const submit = async (expectedAccount: ProjectCopyAccount) => {
    setSubmittedAccount(expectedAccount);
    setError(undefined);
    onSubmitted?.();
    try {
      const result = await deletions.start(id, name, expectedAccount);
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
    if (!expected || writing) return;
    // The caller has a definitive status response for this project. The server resumes by project ID.
    if (active) deletions.discard(active.id);
    setRetrying(true);
    try {
      await submit(expected);
    } finally {
      setRetrying(false);
    }
  };

  const retryStatus = () => {
    void operation.refetch();
    void refreshCatalog();
  };

  return {
    current,
    uncertain: uncertain || checking,
    writing,
    error,
    retrying,
    operation,
    accountMatches,
    retryStatus,
    retry,
    submit,
  };
};

const cloudDeletionProgress = (
  state: CloudProjectDeletion["state"] | undefined,
  input: { uncertain: boolean; canDelete: boolean; error?: string; readError?: Error | null },
) => ({
  canResubmit:
    state === "needs-attention" ||
    (!state &&
      input.uncertain &&
      input.canDelete &&
      input.readError instanceof PstdioApiError &&
      input.readError.status === 404),
  failure:
    input.readError?.message ??
    (state ? undefined : input.error) ??
    (state === "needs-attention" ? "Cloud cleanup has paused. Retry to resume the same operation." : undefined),
});

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
  const { current, uncertain, writing, error, retrying, operation, accountMatches, retryStatus, retry, submit } =
    useCloudDeletion({ id, name, account, receipt, canDelete, cloudOnly, onSubmitted, onCompleted });

  if (accountMatches && (current || uncertain || writing)) {
    const state = current?.state;
    const { canResubmit, failure } = cloudDeletionProgress(state, {
      uncertain,
      canDelete,
      error,
      readError: operation.error,
    });
    return (
      <DeletionProgress
        state={state ?? (writing ? "deleting" : undefined)}
        error={state === "completed" ? undefined : failure}
        canRetry={!writing && (canResubmit || operation.isError)}
        retrying={retrying}
        onRetry={canResubmit ? retry : retryStatus}
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
