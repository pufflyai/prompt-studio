import { createWorkbenchStore, type WorkbenchCore } from "@pstdio/workbench";
import { useEffect, useSyncExternalStore } from "react";
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
  const store = createWorkbenchStore({ name: "desktop.upgrade", initialState: { version: "", open: false } });
  return {
    getState: store.getState,
    subscribe: store.subscribe,
    ready: (version: string, prompt: boolean) =>
      store.setState((current) => ({ version, open: prompt || current.open })),
    setOpen: (open: boolean) => store.setState({ open }),
    restart: () => {
      if (!store.getState().open) return;
      store.setState({ open: false });
      return restartToInstallUpdate.call(bridge);
    },
  };
};

export type DesktopUpgradeController = NonNullable<ReturnType<typeof createDesktopUpgrade>>;

const upgradeItemId = "desktop.upgrade";

export const DesktopUpgradeConfirmation = (props: { workbench: WorkbenchCore; upgrade: DesktopUpgradeController }) => {
  const { workbench, upgrade } = props;
  const { open, version } = useSyncExternalStore(upgrade.subscribe, upgrade.getState, upgrade.getState);
  const ready = Boolean(version);
  useEffect(() => {
    if (!ready) return;
    const view = workbench.views.registerView({
      id: upgradeItemId,
      title: "Desktop upgrade",
      body: { kind: "react", render: () => <DesktopUpgradeButton onClick={() => upgrade.setOpen(true)} /> },
    });
    const item = workbench.statusBar.registerItem({
      id: upgradeItemId,
      viewId: upgradeItemId,
      slot: "trailing",
      system: true,
    });
    return () => {
      item.dispose();
      view.dispose();
    };
  }, [workbench, upgrade, ready]);

  if (!ready) return null;
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
            message: "Choose Upgrade to try again.",
          });
        });
      }}
    />
  );
};
