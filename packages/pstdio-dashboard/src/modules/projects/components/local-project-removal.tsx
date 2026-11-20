import { Button, HStack, Spinner, Text } from "@chakra-ui/react";
import { LocalRemovalConflictError, type LocalRemovalPreflight, type ProjectCopyAccount } from "@pstdio/sdk/client";
import { AlertMessage, Checkbox, DeleteConfirmationModal } from "@pstdio/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { getApiClient } from "@/lib/api";
import { cloudProjectCatalogKey } from "../data/project-catalog";

interface LocalRemovalProps {
  id: string;
  name: string;
  account?: ProjectCopyAccount;
  disabled?: boolean;
  pending?: boolean;
  onRemoved?: () => void;
}

export const LocalProjectRemoval = ({ id, name, account, disabled, pending, onRemoved }: LocalRemovalProps) => {
  const [confirmedAccount, setConfirmedAccount] = useState<ProjectCopyAccount>();
  const request = useRef<AbortController | null>(null);
  const accountMatches =
    confirmedAccount?.managerOrigin === account?.managerOrigin && confirmedAccount?.accountId === account?.accountId;
  const [preflight, setPreflight] = useState<LocalRemovalPreflight>();
  const [reading, setReading] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState<string>();
  const queryClient = useQueryClient();

  const inspect = async (expected: ProjectCopyAccount) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError(undefined);
    setReading(true);
    try {
      const result = await getApiClient().account.projectLocalRemoval(id, { signal: controller.signal });
      if (result.account?.managerOrigin !== expected.managerOrigin || result.account?.accountId !== expected.accountId)
        throw new Error("The active Cloud account changed. Reopen this action to confirm again.");
      if (!controller.signal.aborted) setPreflight(result);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : "Could not check upload completion.");
    } finally {
      if (!controller.signal.aborted) setReading(false);
    }
  };
  const begin = () => {
    if (!account) return;
    setConfirmedAccount(account);
    setDiscard(false);
    setPreflight(undefined);
    void inspect(account);
  };
  const close = () => {
    request.current?.abort();
    setConfirmedAccount(undefined);
  };
  const submit = async () => {
    setError(undefined);
    try {
      await getApiClient().account.removeLocalProject(id, {
        discardUnsynced: discard,
        expectedAccount: confirmedAccount,
      });
      onRemoved?.();
    } catch (failure) {
      if (failure instanceof LocalRemovalConflictError) {
        setPreflight(failure.preflight);
        setDiscard(false);
      }
      setError(failure instanceof Error ? failure.message : "Local cleanup could not finish.");
      throw failure;
    } finally {
      void queryClient.invalidateQueries({ queryKey: cloudProjectCatalogKey });
    }
  };

  return (
    <>
      <Button size="sm" variant="destructive" disabled={disabled || !account} onClick={begin}>
        {pending ? "Retry local removal" : "Delete local version"}
      </Button>
      <DeleteConfirmationModal
        open={Boolean(confirmedAccount)}
        onClose={close}
        onDelete={submit}
        confirmDisabled={
          disabled || !accountMatches || reading || !preflight?.account || (preflight.requiresDiscard && !discard)
        }
        headline={`Delete local version of “${name}”?`}
        notificationText="Downloaded Prompt Studio data, local recovery copies, and caches will be removed from this device. User-selected source folders stay on disk."
        buttonText="Delete local version"
      >
        {reading && (
          <HStack role="status">
            <Spinner size="sm" />
            <Text>Checking upload completion</Text>
          </HStack>
        )}
        {preflight?.removesManagedFolder && <Text>The app-created project folder will also be removed.</Text>}
        {preflight?.retainsUnverifiedFolder && (
          <Text>This project folder will stay on disk because its ownership could not be verified.</Text>
        )}
        {Boolean(preflight?.providerWorkspaceCount) && (
          <Text>
            {preflight?.providerWorkspaceNames?.length
              ? `The workspace providers will remove ${preflight.providerWorkspaceNames.join(", ")}.`
              : `The workspace providers will remove ${preflight?.providerWorkspaceCount} workspaces they created.`}
          </Text>
        )}
        {preflight?.requiresDiscard && (
          <>
            <Text color="fg.error">
              {preflight.uploadState === "pending"
                ? "Pending changes have not uploaded and will be lost."
                : "Upload completion is unknown. Unsynced changes may be lost."}
            </Text>
            <Checkbox checked={discard} onCheckedChange={({ checked }) => setDiscard(checked === true)}>
              Discard unsynced changes
            </Checkbox>
          </>
        )}
        {error && (
          <AlertMessage status="error" compact role="alert">
            {error}
          </AlertMessage>
        )}
        {error && !preflight && confirmedAccount && accountMatches && (
          <Button size="sm" onClick={() => void inspect(confirmedAccount)}>
            Retry
          </Button>
        )}
      </DeleteConfirmationModal>
    </>
  );
};
