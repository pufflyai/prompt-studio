import type { WorkbenchCore } from "@pstdio/workbench";

interface UpdateNotice {
  level: "error" | "info";
  title: string;
  message?: string;
}

type UpdateNoticeEvent = UpdateNotice | { kind: "clear-progress" };

interface DesktopUpdateNoticeBridge {
  onUpdateNotice: (listener: () => void) => () => void;
  takeUpdateNotice: () => Promise<UpdateNoticeEvent | undefined>;
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
  let receiving = false;
  let requested = false;
  const takeNotices = async () => {
    receiving = true;
    while (connected && requested) {
      requested = false;
      let notice: UpdateNoticeEvent | undefined;
      try {
        notice = await bridge.takeUpdateNotice();
      } catch {
        continue;
      }
      if (!notice || !connected) continue;
      if ("kind" in notice) {
        pending = undefined;
        owner?.notifications.dismiss(updateNoticeId);
      } else {
        pending = notice;
        publish();
      }
    }
    receiving = false;
  };
  const receive = () => {
    requested = true;
    if (!receiving) void takeNotices();
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
