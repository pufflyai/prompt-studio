import { Button, HStack, Spinner, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../core";
import type { OperationRecovery } from "../../core/registries/mutations/operation-types";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { extensionCommandOperation } from "../../extensions/host/workbench-command-operation";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchActionErrors } from "./action-errors";

const inProject = (entry: { projectId?: string }, projectId?: string) =>
  entry.projectId === undefined || entry.projectId === projectId;

export const useOperationActivity = (workbench: WorkbenchCore) => {
  const operations = getWorkbenchOperations(getWorkbenchQueries(workbench));
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const snapshot = useSyncExternalStore(operations.subscribe, operations.getSnapshot, operations.getSnapshot);
  return {
    pending: snapshot.pending.filter(
      (entry) =>
        entry.showPending &&
        inProject(entry, projectId) &&
        entry.status !== "unknown" &&
        entry.status !== "unconfirmed",
    ),
    recovery: snapshot.recovery.filter((entry) => entry.projectUnavailable || inProject(entry, projectId)),
  };
};

export const OperationProgressIndicator = ({ title }: { title: string }) => (
  <HStack gap="xs" role="status">
    <Spinner size="xs" />
    <Text textStyle="label/XS/medium">{title}</Text>
  </HStack>
);

export const OperationRecoveryItem = (props: { workbench: WorkbenchCore; entry: OperationRecovery }) => {
  const { workbench, entry } = props;
  const { id, sourceCommand, draft, status } = entry;
  const operations = getWorkbenchOperations(getWorkbenchQueries(workbench));
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const sourceIsCurrent = !entry.projectUnavailable && inProject(entry, projectId);
  const currentRecovery = () =>
    operations
      .getSnapshot()
      .recovery.find(
        (item) =>
          item.id === id && (item.projectUnavailable || inProject(item, workbench.pages.store.getState().projectId)),
      );
  const sourceIsStillCurrent = () => {
    const current = currentRecovery();
    return Boolean(current && !current.projectUnavailable);
  };
  const target = `system-errors.operation.${id.description ?? "recovery"}`;
  const report = (title: string) => workbench.notifications.captureActionError(title, target);
  const discard = () => {
    if (!currentRecovery()) return;
    try {
      operations.discard(id);
    } catch (error) {
      report("Discard draft")(error);
    }
  };
  const download = (file: File) => {
    const current = currentRecovery();
    if (!current?.files?.includes(file)) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const failure = entry.error instanceof Error ? entry.error.message : "The change could not be confirmed.";
  const message = status === "unknown" ? (entry.description ?? "The result could not be confirmed.") : failure;
  const canInspect =
    sourceIsCurrent &&
    status === "unknown" &&
    (entry.domain === "resource.create" ||
      entry.domain === extensionCommandOperation ||
      (!sourceCommand && entry.source));
  return (
    <AlertMessage
      status="error"
      title={entry.title}
      compact
      onClose={entry.dismissed ? undefined : () => currentRecovery() && operations.dismiss(id)}
      closeLabel={`Dismiss alert for ${entry.title}`}
    >
      <Text>{message}</Text>
      <HStack gap="xs" wrap="wrap">
        {sourceCommand && sourceIsCurrent ? (
          <Button
            size="2xs"
            onClick={() => {
              if (!sourceIsStillCurrent()) return;
              void workbench.commands
                .executeCommand(sourceCommand.id, sourceCommand.args)
                .catch(report("Return to source"));
            }}
          >
            Return to source
          </Button>
        ) : null}
        {canInspect && (
          <Button
            size="2xs"
            onClick={() => {
              if (!sourceIsStillCurrent()) return;
              workbench.commandPalette.open({
                view: "main",
                initialQuery: entry.domain === "resource.presentation" ? entry.source?.label : undefined,
              });
            }}
          >
            Inspect resources
          </Button>
        )}
        {entry.canCheck && sourceIsCurrent ? (
          <Button
            size="2xs"
            onClick={() => {
              if (sourceIsStillCurrent()) void operations.check(id);
            }}
          >
            Check again
          </Button>
        ) : null}
        {draft !== undefined ? (
          <>
            <Button
              size="2xs"
              onClick={() => {
                void Promise.resolve()
                  .then(() => {
                    const value = currentRecovery()?.draft;
                    if (value !== undefined)
                      return navigator.clipboard.writeText(typeof value === "string" ? value : JSON.stringify(value));
                  })
                  .catch(report("Copy draft"));
              }}
            >
              {entry.domain === extensionCommandOperation ? "Copy action details" : "Copy draft"}
            </Button>
            <Button size="2xs" variant="destructive" onClick={discard}>
              Discard draft
            </Button>
          </>
        ) : null}
        {entry.files?.map((file, index) => (
          <Button key={`${file.name}.${index}`} size="2xs" onClick={() => download(file)}>
            Download {file.name}
          </Button>
        ))}
        {draft === undefined && (entry.retired || status === "rejected") ? (
          <Button size="2xs" onClick={discard}>
            Clear
          </Button>
        ) : null}
      </HStack>
      <WorkbenchActionErrors workbench={workbench} target={target} anchored={false} />
    </AlertMessage>
  );
};
