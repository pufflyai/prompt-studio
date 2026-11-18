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

const updateNoticeId = "desktop.update";

export const connectDesktopUpdateNotices = (
  bridge: unknown,
  getWorkbench: () => WorkbenchCore | undefined,
  subscribeWorkbench?: (listener: () => void) => () => void,
) => {
  if (!hasUpdateNotices(bridge)) return;
  let connected = true;
  let pending: UpdateNotice | undefined;
  let owner: WorkbenchCore | undefined;
  let dismissal: ReturnType<WorkbenchCore["notifications"]["subscribe"]> | undefined;
  const publish = () => {
    if (pending) owner?.notifications.show({ ...pending, id: updateNoticeId });
  };
  const followActiveWorkbench = () => {
    const next = getWorkbench();
    if (next === owner) return;
    dismissal?.dispose();
    owner?.notifications.dismiss(updateNoticeId);
    owner = next;
    dismissal = owner?.notifications.subscribe((event) => {
      if (event.type === "dismiss" && event.id === updateNoticeId) pending = undefined;
    });
    publish();
  };
  const receive = () => {
    void bridge
      .takeUpdateNotice()
      .then((notice) => {
        if (!notice || !connected) return;
        pending = notice;
        publish();
      })
      .catch(() => {});
  };
  followActiveWorkbench();
  const stopWorkbench = subscribeWorkbench?.(followActiveWorkbench);
  const stop = bridge.onUpdateNotice(receive);
  receive();
  return () => {
    connected = false;
    dismissal?.dispose();
    stopWorkbench?.();
    stop();
  };
};
