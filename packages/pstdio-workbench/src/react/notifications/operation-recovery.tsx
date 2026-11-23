import { Button, HStack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../core";
import type { OperationRecovery } from "../../core/registries/mutations/operation-types";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchActionErrors } from "./action-errors";

export const useOperationRecovery = (workbench: WorkbenchCore) => {
  const operations = getWorkbenchOperations(getWorkbenchQueries(workbench));
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const { recovery } = useSyncExternalStore(operations.subscribe, operations.getSnapshot, operations.getSnapshot);
  return recovery.filter((entry) => entry.projectId === undefined || entry.projectId === projectId);
};

export const OperationRecoveryItem = (props: { workbench: WorkbenchCore; entry: OperationRecovery }) => {
  const { workbench, entry } = props;
  const { id, sourceCommand, draft, status } = entry;
  const operations = getWorkbenchOperations(getWorkbenchQueries(workbench));
  const target = `system-errors.operation.${id.description ?? "recovery"}`;
  const report = (title: string) => workbench.notifications.captureActionError(title, target);
  const failure = entry.error instanceof Error ? entry.error.message : "The change could not be confirmed.";
  const message = status === "unknown" ? "The result could not be confirmed." : failure;
  const canInspect = status === "unknown" && entry.domain === "resource.create";
  return (
    <AlertMessage
      status="error"
      title={entry.title}
      compact
      onClose={entry.dismissed ? undefined : () => operations.dismiss(id)}
      closeLabel={`Dismiss alert for ${entry.title}`}
    >
      <Text>{message}</Text>
      <HStack gap="xs" wrap="wrap">
        {sourceCommand ? (
          <Button
            size="2xs"
            onClick={() =>
              void workbench.commands
                .executeCommand(sourceCommand.id, sourceCommand.args)
                .catch(report("Return to source"))
            }
          >
            Return to source
          </Button>
        ) : null}
        {canInspect && (
          <Button size="2xs" onClick={() => workbench.commandPalette.open({ view: "main" })}>
            Inspect resources
          </Button>
        )}
        {entry.canCheck ? (
          <Button size="2xs" onClick={() => void operations.check(id)}>
            Check again
          </Button>
        ) : null}
        {draft !== undefined ? (
          <>
            <Button
              size="2xs"
              onClick={() => {
                void Promise.resolve()
                  .then(() => navigator.clipboard.writeText(typeof draft === "string" ? draft : JSON.stringify(draft)))
                  .catch(report("Copy draft"));
              }}
            >
              Copy draft
            </Button>
            <Button size="2xs" variant="destructive" onClick={() => operations.discard(id)}>
              Discard draft
            </Button>
          </>
        ) : null}
        {draft === undefined && status === "rejected" ? (
          <Button size="2xs" onClick={() => operations.discard(id)}>
            Clear
          </Button>
        ) : null}
      </HStack>
      <WorkbenchActionErrors workbench={workbench} target={target} anchored={false} />
    </AlertMessage>
  );
};
