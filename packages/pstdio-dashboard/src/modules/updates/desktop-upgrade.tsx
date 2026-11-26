import { createWorkbenchStore, type WorkbenchCore } from "@pstdio/workbench";
import { useEffect, useSyncExternalStore } from "react";
import type { DesktopUpgradeNotice } from "@/lib/desktop-update-notices";
import { DesktopUpgradeButton, DesktopUpgradeDialog } from "./components/desktop-upgrade";

type RestartConsent = "confirm" | "waiting";

export const createDesktopUpgrade = (bridge: unknown) => {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    !("restartToInstallUpdate" in bridge) ||
    typeof bridge.restartToInstallUpdate !== "function"
  )
    return;
  const restartToInstallUpdate = bridge.restartToInstallUpdate as () => Promise<void>;
  const store = createWorkbenchStore<{
    availability: DesktopUpgradeNotice | null;
    dialog: "closed" | RestartConsent;
  }>({
    name: "desktop.upgrade",
    initialState: { availability: null, dialog: "closed" },
  });
  return {
    getState: store.getState,
    subscribe: store.subscribe,
    update: (availability: DesktopUpgradeNotice | null) => {
      const current = store.getState();
      if (!availability) {
        store.setState({ availability: null, dialog: "closed" });
        return current.dialog !== "closed";
      }
      const dialog = current.availability?.version === availability.version ? current.dialog : "closed";
      store.setState({
        availability,
        dialog: availability.prompt && dialog === "closed" ? "confirm" : dialog,
      });
      return false;
    },
    setOpen: (open: boolean) => store.setState({ dialog: open ? "confirm" : "closed" }),
    restart: (consent: RestartConsent) => {
      const { availability, dialog } = store.getState();
      if (!availability || dialog !== consent) return;
      if (!availability.ready) {
        store.setState({ dialog: "waiting" });
        return;
      }
      store.setState({ dialog: "closed" });
      return restartToInstallUpdate.call(bridge);
    },
  };
};

export type DesktopUpgradeController = NonNullable<ReturnType<typeof createDesktopUpgrade>>;

const upgradeItemId = "desktop.upgrade";

const requestRestart = (workbench: WorkbenchCore, upgrade: DesktopUpgradeController, consent: RestartConsent) => {
  const errorId = `${upgradeItemId}.error`;
  workbench.notifications.dismiss(errorId);
  void upgrade.restart(consent)?.catch(() => {
    workbench.notifications.show({
      id: errorId,
      level: "error",
      title: "Prompt Studio couldn’t restart.",
      message: "Choose Upgrade to try again.",
    });
  });
};

export const DesktopUpgradeConfirmation = (props: { workbench: WorkbenchCore; upgrade: DesktopUpgradeController }) => {
  const { workbench, upgrade } = props;
  const { availability, dialog } = useSyncExternalStore(upgrade.subscribe, upgrade.getState, upgrade.getState);
  const available = Boolean(availability);
  const restartAfterDownload = dialog === "waiting" && availability?.ready;
  useEffect(() => {
    if (restartAfterDownload) requestRestart(workbench, upgrade, "waiting");
  }, [restartAfterDownload, workbench, upgrade]);
  useEffect(() => {
    if (!available) return;
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
  }, [workbench, upgrade, available]);

  if (!availability) return null;
  return (
    <DesktopUpgradeDialog
      open={dialog !== "closed"}
      version={availability.version}
      ready={availability.ready}
      waiting={dialog === "waiting"}
      onOpenChange={upgrade.setOpen}
      onRestart={() => requestRestart(workbench, upgrade, "confirm")}
    />
  );
};
