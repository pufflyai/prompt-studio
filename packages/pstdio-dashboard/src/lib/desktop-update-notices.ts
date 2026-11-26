import type { WorkbenchCore } from "@pstdio/workbench";

interface UpdateNotice {
  level: "error" | "info";
  title: string;
  message?: string;
}

export type DesktopUpgradeNotice = { version: string };

type UpdateNoticeEvent =
  | UpdateNotice
  | {
      kind: "progress";
      title?: string | null;
      outcome?: UpdateNotice;
      installed?: UpdateNotice;
      upgrade?: DesktopUpgradeNotice | null;
    };

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
const updateProgressId = "desktop.update.progress";
const installedNoticeId = "desktop.update.installed";

export const connectDesktopUpdateNotices = (
  bridge: unknown,
  getWorkbench: () => WorkbenchCore | undefined,
  subscribeWorkbench?: (listener: () => void) => () => void,
  onUpgradeChange?: (notice: DesktopUpgradeNotice | null) => void,
) => {
  if (!hasUpdateNotices(bridge)) return;
  let connected = true;
  const unread = new Map<string, UpdateNotice>();
  let owner: WorkbenchCore | undefined;
  let dismissal: ReturnType<WorkbenchCore["notifications"]["subscribe"]> | undefined;
  const publish = (id: string, notice: UpdateNotice) => {
    unread.set(id, notice);
    owner?.notifications.show({ ...notice, id });
  };
  const clearProgress = () => {
    unread.delete(updateProgressId);
    owner?.notifications.dismiss(updateProgressId);
  };
  const followActiveWorkbench = () => {
    const next = getWorkbench();
    if (next === owner) return;
    dismissal?.dispose();
    for (const id of unread.keys()) owner?.notifications.dismiss(id);
    owner = next;
    dismissal = owner?.notifications.subscribe((event) => {
      if (event.type === "dismiss") unread.delete(event.id);
    });
    for (const [id, notice] of unread) owner?.notifications.show({ ...notice, id });
  };
  const applyNotice = (notice: UpdateNoticeEvent) => {
    if (!("kind" in notice)) {
      publish(updateNoticeId, notice);
      return;
    }
    if (notice.title) publish(updateProgressId, { title: notice.title, level: "info" });
    else if (notice.title === null) clearProgress();
    if (notice.upgrade) {
      unread.delete(updateNoticeId);
      owner?.notifications.dismiss(updateNoticeId);
    }
    if (notice.outcome) publish(updateNoticeId, notice.outcome);
    if (notice.installed) publish(installedNoticeId, notice.installed);
    if (notice.upgrade !== undefined) onUpgradeChange?.(notice.upgrade);
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
      applyNotice(notice);
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
