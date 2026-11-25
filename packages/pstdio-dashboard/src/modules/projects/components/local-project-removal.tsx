import { Button, HStack, Spinner, Text } from "@chakra-ui/react";
import {
  type DeviceLogin,
  LocalRemovalConflictError,
  type LocalRemovalPreflight,
  type ProjectCopyAccount,
} from "@pstdio/sdk/client";
import { AlertMessage, Checkbox, DeleteConfirmationModal } from "@pstdio/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useCloudLocalRemoval } from "../data/cloud-local-removal";
import { cloudProjectCatalogKey } from "../data/project-catalog";
import { sameProjectCopyDevice } from "../data/project-copy-scope";

interface LocalRemovalProps {
  id: string;
  name: string;
  account?: ProjectCopyAccount;
  login?: DeviceLogin;
  disabled?: boolean;
  pending?: boolean;
  onRemoved?: () => void;
}

export const LocalProjectRemoval = ({ id, name, account, login, disabled, pending, onRemoved }: LocalRemovalProps) => {
  const [confirmed, setConfirmed] = useState<{ account: ProjectCopyAccount; login: DeviceLogin }>();
  const confirmedAccount = confirmed?.account;
  const request = useRef<AbortController | null>(null);
  const accountMatches =
    confirmedAccount?.managerOrigin === account?.managerOrigin &&
    confirmedAccount?.accountId === account?.accountId &&
    sameProjectCopyDevice(login, confirmed?.login);
  const [preflight, setPreflight] = useState<LocalRemovalPreflight>();
  const [reading, setReading] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState<string>();
  const queryClient = useQueryClient();
  const removal = useCloudLocalRemoval();
  const busy = removal.active(id, account, login);
  useEffect(() => () => request.current?.abort(), []);

  const inspect = async (expected: ProjectCopyAccount, expectedDevice: DeviceLogin) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError(undefined);
    setReading(true);
    try {
      const result = await removal.preflight(id, expectedDevice, controller.signal);
      if (
        result.projectId !== id ||
        result.account?.managerOrigin !== expected.managerOrigin ||
        result.account?.accountId !== expected.accountId
      )
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
    if (!account || !login || removal.active(id, account, login)) return;
    setConfirmed({ account, login });
    setDiscard(false);
    setPreflight(undefined);
    void inspect(account, login);
  };
  const close = () => {
    request.current?.abort();
    setConfirmed(undefined);
  };
  const submit = async () => {
    setError(undefined);
    try {
      if (!confirmed || !accountMatches) throw new Error("Reopen this action to confirm the active account.");
      await removal.remove(id, name, confirmed.account, confirmed.login, discard);
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
      <Button size="sm" variant="destructive" disabled={disabled || busy || !account || !login} onClick={begin}>
        {pending ? "Retry local removal" : "Delete local version"}
      </Button>
      <DeleteConfirmationModal
        open={Boolean(confirmedAccount)}
        onClose={close}
        onDelete={submit}
        confirmDisabled={
          disabled ||
          busy ||
          !accountMatches ||
          reading ||
          !preflight?.account ||
          (preflight.requiresDiscard && !discard)
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
        {error && !preflight && confirmed && accountMatches && (
          <Button size="sm" onClick={() => void inspect(confirmed.account, confirmed.login)}>
            Retry
          </Button>
        )}
      </DeleteConfirmationModal>
    </>
  );
};
