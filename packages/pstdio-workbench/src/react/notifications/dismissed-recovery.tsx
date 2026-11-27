import { Stack } from "@chakra-ui/react";
import { ScopedDialog as Dialog, ScrollArea } from "@pstdio/ui";
import { useLayoutEffect } from "react";
import type { WorkbenchCore } from "../../core";
import { workbenchCommandPaletteMenuPath } from "../../core/registries/menus/workbench-menu-paths";
import { OperationRecoveryItem, useOperationActivity } from "./operation-recovery";

const commandId = "workbench.system-activity.recover-changes";
const viewId = "workbench.system-activity.dismissed-recovery";
const title = "Recover changes";

const DismissedRecovery = ({ workbench }: { workbench: WorkbenchCore }) => {
  const { recovery } = useOperationActivity(workbench);
  return (
    <>
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
      </Dialog.Header>
      <ScrollArea maxH="65dvh" contentProps={{ paddingX: "md", paddingBottom: "md" }}>
        <Stack gap="sm">
          {recovery
            .filter((entry) => entry.dismissed)
            .map((entry) => (
              <OperationRecoveryItem key={entry.id.description} workbench={workbench} entry={entry} />
            ))}
        </Stack>
      </ScrollArea>
    </>
  );
};

export const useDismissedRecovery = (workbench: WorkbenchCore, hasDismissedRecovery: boolean) => {
  useLayoutEffect(() => {
    if (!hasDismissedRecovery) return;
    const view = workbench.views.registerView({
      id: viewId,
      title,
      body: { kind: "react", render: () => <DismissedRecovery workbench={workbench} /> },
    });
    const overlay = workbench.overlays.registerOverlay({ id: viewId, viewId, config: { size: "md" } });
    const command = workbench.commands.registerCommand(
      { id: commandId, label: title, category: "System activity" },
      { execute: () => workbench.overlays.openOverlay(viewId, { title }) },
    );
    const menuItem = workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId });
    return () => {
      menuItem.dispose();
      command.dispose();
      overlay.dispose();
      view.dispose();
    };
  }, [workbench, hasDismissedRecovery]);
};
