import type { WorkbenchCore } from "@pstdio/workbench";

interface UpdateNotice {
  level: "error" | "info";
  title: string;
  message?: string;
}

interface DesktopUpdateNoticeBridge {
  onUpdateNotice: (listener: () => void) => () => void;
  takeUpdateNotice: () => Promise<UpdateNotice | undefined>;
}

const hasUpdateNotices = (bridge: unknown): bridge is DesktopUpdateNoticeBridge =>
  Boolean(
    bridge &&
      typeof bridge === "object" &&
      "onUpdateNotice" in bridge &&
      typeof bridge.onUpdateNotice === "function" &&
      "takeUpdateNotice" in bridge &&
      typeof bridge.takeUpdateNotice === "function",
  );

export const connectDesktopUpdateNotices = (bridge: unknown, getWorkbench: () => WorkbenchCore | undefined) => {
  if (!hasUpdateNotices(bridge)) return;
  let connected = true;
  const receive = () => {
    void bridge
      .takeUpdateNotice()
      .then((notice) => {
        if (!notice || !connected) return;
        getWorkbench()?.notifications.show({ ...notice, id: "desktop.update" });
      })
      .catch(() => {});
  };
  const stop = bridge.onUpdateNotice(receive);
  receive();
  return () => {
    connected = false;
    stop();
  };
};
