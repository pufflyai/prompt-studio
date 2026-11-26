import { createWorkbenchStore, type WorkbenchCore } from "@pstdio/workbench";
import { useEffect, useSyncExternalStore } from "react";
import type { DesktopUpgradeNotice } from "@/lib/desktop-update-notices";
import { DesktopUpgradeButton, DesktopUpgradeDialog } from "./components/desktop-upgrade";

export const createDesktopUpgrade = (bridge: unknown) => {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    !("restartToInstallUpdate" in bridge) ||
    typeof bridge.restartToInstallUpdate !== "function"
  )
    return;
  const restartToInstallUpdate = bridge.restartToInstallUpdate as () => Promise<void>;
  const store = createWorkbenchStore<{ version: string | null; open: boolean }>({
    name: "desktop.upgrade",
    initialState: { version: null, open: false },
  });
  return {
    getState: store.getState,
    subscribe: store.subscribe,
    update: (update: DesktopUpgradeNotice | null) =>
      store.setState((current) => ({
        version: update?.version ?? null,
        open: current.open && current.version === update?.version,
      })),
    setOpen: (open: boolean) => store.setState({ open }),
    restart: () => {
      const { version, open } = store.getState();
      if (!version || !open) return;
      store.setState({ open: false });
      return restartToInstallUpdate.call(bridge);
    },
  };
};

export type DesktopUpgradeController = NonNullable<ReturnType<typeof createDesktopUpgrade>>;

const upgradeItemId = "desktop.upgrade";

export const DesktopUpgradeConfirmation = (props: { workbench: WorkbenchCore; upgrade: DesktopUpgradeController }) => {
  const { workbench, upgrade } = props;
  const { version, open } = useSyncExternalStore(upgrade.subscribe, upgrade.getState, upgrade.getState);
  const available = Boolean(version);
  useEffect(() => {
    if (!available) return;
    const view = workbench.views.registerView({
      id: upgradeItemId,
      title: "Update available",
      body: { kind: "react", render: () => <DesktopUpgradeButton onClick={() => upgrade.setOpen(true)} /> },
    });
    const item = workbench.statusBar.registerItem({
      id: upgradeItemId,
      viewId: upgradeItemId,
      slot: "leading",
      system: true,
    });
    return () => {
      item.dispose();
      view.dispose();
    };
  }, [workbench, upgrade, available]);

  if (!version) return null;
  return (
    <DesktopUpgradeDialog
      open={open}
      version={version}
      onOpenChange={upgrade.setOpen}
      onRestart={() => {
        const errorId = `${upgradeItemId}.error`;
        workbench.notifications.dismiss(errorId);
        void upgrade.restart()?.catch(() => {
          workbench.notifications.show({
            id: errorId,
            level: "error",
            title: "Prompt Studio couldn’t restart.",
            message: "Choose Update available to try again.",
          });
        });
      }}
    />
  );
};
