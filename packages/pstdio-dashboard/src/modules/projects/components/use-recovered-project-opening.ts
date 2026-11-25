import type { DeviceLogin, ProjectCopyAccount } from "@pstdio/sdk/client";
import { useWorkbenchStore, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getCloudCopyDownloads } from "../data/cloud-copy-download";
import type { useCloudLocalRemoval } from "../data/cloud-local-removal";

export const useRecoveredProjectOpening = (
  input: WorkbenchPanelRenderInput,
  scope: string,
  options: {
    id: string;
    name?: string;
    ready: boolean;
    account?: ProjectCopyAccount;
    login?: DeviceLogin;
    localRemoval: ReturnType<typeof useCloudLocalRemoval>;
  },
) => {
  const { id, name, ready, account, login, localRemoval } = options;
  const { workbench, instance } = input;
  const active = useWorkbenchStore(workbench.activation.store, (state) => state.active);
  const operations = getCloudCopyDownloads();
  const observing = useRef<ReturnType<typeof operations.observeOpening>>(undefined);
  const handled = useRef<string>(undefined);
  const eligible = useRef<{
    key: string;
    name: string;
    account: ProjectCopyAccount;
    device: DeviceLogin;
  }>(undefined);
  const openingKey = JSON.stringify([scope, instance.instanceId]);
  const canOpen = ready && Boolean(name && account && login);

  useLayoutEffect(() => {
    eligible.current =
      ready && name && account && login ? { key: openingKey, name, account, device: login } : undefined;
    return () => {
      eligible.current = undefined;
    };
  }, [account, login, name, openingKey, ready]);

  useEffect(() => {
    const opening = operations.observeOpening(scope);
    observing.current = opening;
    return () => {
      opening.release();
      observing.current = undefined;
    };
  }, [operations, scope]);

  useEffect(
    () =>
      operations.subscribeToLocalRemoval((removedScope) => {
        if (removedScope === scope && eligible.current?.key === openingKey) eligible.current = undefined;
      }),
    [openingKey, operations, scope],
  );

  useEffect(() => {
    if (!active || !canOpen || handled.current === openingKey) return;
    void observing.current?.open({
      id,
      read() {
        const current = eligible.current;
        if (
          current?.key !== openingKey ||
          !workbench.activation.isActive() ||
          handled.current === openingKey ||
          localRemoval.isRemoving(id, current.account, current.device)
        )
          return undefined;
        return current;
      },
      close() {
        handled.current = openingKey;
        workbench.overlays.closeOverlay(instance.instanceId);
      },
      select: (name) => workbench.commands.executeCommand(dashboardCommandIds.selectProject, { project: { id, name } }),
    });
  }, [active, canOpen, id, instance.instanceId, localRemoval, openingKey, workbench]);
};
