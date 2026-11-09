import { createTabWindowTarget, type WorkbenchCore, type WorkbenchWindowHost } from "@pstdio/workbench";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { readPageUrlProjectId } from "@/shared/app/page-location-browser";

// PS-1128 prototype. Every dashboard window joins one BroadcastChannel. A tab moves as a
// navigation target: the receiving window opens it and confirms, then the sending window
// closes its copy. The desktop app and a browser use the same path; the desktop only decides
// that a same-origin window.open becomes a native window.

type NavigationTarget = Parameters<WorkbenchWindowHost["openInWindow"]>[0];

type WindowMessage =
  | { type: "hello"; id: string; label: string; projectId?: string; reply: boolean }
  | { type: "bye"; id: string }
  | { type: "open"; to: string; requestId: string; target: NavigationTarget; move: boolean }
  | { type: "opened"; requestId: string; ok: boolean };

const CHANNEL = "pstdio.dashboard-windows";
const PARAMS = {
  id: "pstdio-window",
  label: "pstdio-window-label",
  home: "pstdio-window-home",
  open: "pstdio-window-open",
  request: "pstdio-window-request",
  move: "pstdio-window-move",
} as const;
// A new window boots the whole dashboard and its extensions before it can confirm.
const NEW_WINDOW_TIMEOUT_MS = 90_000;
const OPEN_WINDOW_TIMEOUT_MS = 20_000;
const OPEN_RETRY_MS = 500;

const randomId = () => crypto.randomUUID();
const encodeTarget = (target: NavigationTarget) => btoa(encodeURIComponent(JSON.stringify(target)));
const decodeTarget = (value: string) => JSON.parse(decodeURIComponent(atob(value))) as NavigationTarget;
const targetKey = (target: NavigationTarget) => JSON.stringify(target);
const currentProjectId = () => readPageUrlProjectId(window.location.href);

export interface DashboardWindowLaunch {
  id: string;
  label: string;
  /** The window that opened this one; tabs return there when this window closes. */
  home?: string;
  open?: { target: NavigationTarget; requestId?: string; move: boolean };
}

/** Reads and removes this window's launch parameters before the workbench reads the URL. */
export const takeDashboardWindowLaunch = (): DashboardWindowLaunch => {
  const url = new URL(window.location.href);
  const id = url.searchParams.get(PARAMS.id);
  const label = url.searchParams.get(PARAMS.label);
  const home = url.searchParams.get(PARAMS.home) ?? undefined;
  const open = url.searchParams.get(PARAMS.open);
  const request = url.searchParams.get(PARAMS.request) ?? undefined;
  const move = url.searchParams.get(PARAMS.move) === "1";
  for (const name of Object.values(PARAMS)) url.searchParams.delete(name);
  if (!id) return { id: `main-${randomId()}`, label: "Main window" };
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  let target: NavigationTarget | undefined;
  try {
    target = open ? decodeTarget(open) : undefined;
  } catch {
    target = undefined;
  }
  return {
    id,
    label: label ?? "Window",
    ...(home ? { home } : {}),
    ...(target ? { open: { target, move, ...(request ? { requestId: request } : {}) } } : {}),
  };
};

export const isSecondaryWindow = (launch: DashboardWindowLaunch) => Boolean(launch.home);

/** A secondary window starts from the main window's saved state but never writes over it. */
export const createSecondaryWindowStorage = (base: WorkbenchStorageLike | undefined): WorkbenchStorageLike => {
  const overlay = new Map<string, string | null>();
  return {
    getItem: (key) => (overlay.has(key) ? (overlay.get(key) ?? null) : (base?.getItem(key) ?? null)),
    setItem: (key, value) => {
      overlay.set(key, value);
    },
    removeItem: (key) => {
      overlay.set(key, null);
    },
  };
};

export const createDashboardWindows = (launch: DashboardWindowLaunch) => {
  const channel = new BroadcastChannel(CHANNEL);
  const peers = new Map<string, { label: string; projectId?: string }>();
  const listeners = new Set<() => void>();
  const pending = new Map<string, (ok: boolean) => void>();
  const received = new Set<string>();
  let targets: readonly { id: string; label: string }[] = [];
  let core: WorkbenchCore | undefined;

  const post = (message: WindowMessage) => channel.postMessage(message);
  const refresh = () => {
    const projectId = currentProjectId();
    targets = [...peers.entries()]
      .filter(([, peer]) => !projectId || !peer.projectId || peer.projectId === projectId)
      .map(([id, peer]) => ({ id, label: peer.label }));
    for (const listener of listeners) listener();
  };
  const hello = (reply: boolean) =>
    post({ type: "hello", id: launch.id, label: launch.label, projectId: currentProjectId(), reply });

  const openHere = async (target: NavigationTarget, move: boolean) => {
    // Extensions register their pages and panels after the workbench starts. Keep trying
    // until the target resolves instead of failing a move that arrived early.
    const deadline = Date.now() + NEW_WINDOW_TIMEOUT_MS;
    for (;;) {
      try {
        if (!core) throw new Error("The workbench is not ready");
        await core.navigation.openTarget(target);
        // Only moved tabs go back when this window closes; an opened copy already has a home.
        if (move) received.add(targetKey(target));
        return true;
      } catch (error) {
        if (Date.now() > deadline) {
          console.warn("Could not open the moved tab", error);
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, OPEN_RETRY_MS));
      }
    }
  };

  const waitForConfirmation = (requestId: string, timeoutMs: number) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("The other window did not open the tab"));
      }, timeoutMs);
      pending.set(requestId, (ok) => {
        clearTimeout(timer);
        pending.delete(requestId);
        if (ok) resolve();
        else reject(new Error("The other window could not open the tab"));
      });
    });

  channel.onmessage = (event: MessageEvent<WindowMessage>) => {
    const message = event.data;
    if (message.type === "hello" && message.id !== launch.id) {
      peers.set(message.id, { label: message.label, projectId: message.projectId });
      if (message.reply) hello(false);
      refresh();
    } else if (message.type === "bye") {
      if (peers.delete(message.id)) refresh();
    } else if (message.type === "open" && message.to === launch.id) {
      void openHere(message.target, message.move).then((ok) =>
        post({ type: "opened", requestId: message.requestId, ok }),
      );
    } else if (message.type === "opened") {
      pending.get(message.requestId)?.(message.ok);
    }
  };

  const nextLabel = () => {
    const numbers = [launch.label, ...[...peers.values()].map((peer) => peer.label)].map((label) =>
      Number(/^Window (\d+)$/.exec(label)?.[1] ?? 1),
    );
    return `Window ${Math.max(1, ...numbers) + 1}`;
  };

  const host: WorkbenchWindowHost = {
    label: launch.label,
    getTargets: () => targets,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    openInWindow: async (target, options = {}) => {
      const { windowId, move = false } = options;
      const requestId = randomId();
      if (windowId) {
        const confirmed = waitForConfirmation(requestId, OPEN_WINDOW_TIMEOUT_MS);
        post({ type: "open", to: windowId, requestId, target, move });
        await confirmed;
        received.delete(targetKey(target));
        return;
      }
      const url = new URL(window.location.href);
      url.hash = "";
      url.searchParams.set(PARAMS.id, randomId());
      url.searchParams.set(PARAMS.label, nextLabel());
      url.searchParams.set(PARAMS.home, launch.home ?? launch.id);
      url.searchParams.set(PARAMS.open, encodeTarget(target));
      url.searchParams.set(PARAMS.request, requestId);
      if (move) url.searchParams.set(PARAMS.move, "1");
      const confirmed = waitForConfirmation(requestId, NEW_WINDOW_TIMEOUT_MS);
      window.open(url.href, "_blank");
      await confirmed;
      received.delete(targetKey(target));
    },
  };

  const returnTabsHome = () => {
    if (!core || !launch.home) return;
    const layout = core.layout.getLayout();
    for (const region of Object.values(layout.regions)) {
      for (const placement of region.widgets) {
        const target = createTabWindowTarget(core, placement);
        if (target && received.has(targetKey(target))) {
          post({ type: "open", to: launch.home, requestId: randomId(), target, move: false });
        }
      }
    }
  };

  return {
    host,
    start(workbench: WorkbenchCore) {
      core = workbench;
      hello(true);
      core.pageLocations.onDidNavigate(() => hello(false));
      window.addEventListener("pagehide", () => {
        // Closing a window keeps its tabs: they return to the window that opened it.
        returnTabsHome();
        post({ type: "bye", id: launch.id });
        channel.close();
      });
      const open = launch.open;
      if (open) {
        void openHere(open.target, open.move).then((ok) => {
          if (open.requestId) post({ type: "opened", requestId: open.requestId, ok });
        });
      }
    },
  };
};
