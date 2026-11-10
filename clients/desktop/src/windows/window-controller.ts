import { join } from "node:path";
import { BrowserWindow, type Session, session, shell, WebContentsView } from "electron";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { createLogger } from "pstdio-logging";
import { DESKTOP_CHANNELS, type DesktopStartupAppearance } from "../desktop-api";
import type { DesktopState } from "../lifecycle/lifecycle-machine";
import type { OwnedFrame } from "../performance/process-attribution";
import { secureSession, secureWebContents } from "../security/apply-window-security";
import { createRuntimeLoginUrl } from "../security/runtime-session";
import { createSecureWindowOptions } from "../security/window-security";
import { LIFECYCLE_SCHEME, LIFECYCLE_URL, readLifecycleAsset } from "./lifecycle-protocol";
import type { TitleBarAppearance } from "./title-bar-appearance";
import { prepareWorkbenchDocument } from "./workbench-loading";

const WORKBENCH_PARTITION = "pstdio-workbench";
const logger = createLogger({ component: "desktop", level: "info", service: "pstdio-desktop", sync: true });

export class DesktopWindowController {
  #runtimeOrigin: string | null = null;
  #workbench: WebContentsView | null = null;
  #workbenchLoad: Promise<void> | undefined;
  #workbenchRuntimeId: string | undefined;
  readonly #shown: Promise<void>;
  readonly lifecycleUrl: string;
  readonly window: BrowserWindow;

  private constructor(
    private readonly preloadPath: string,
    workbenchSession: Session,
    appearance: DesktopStartupAppearance | undefined,
  ) {
    this.lifecycleUrl = LIFECYCLE_URL;
    secureSession(workbenchSession, () => this.#runtimeOrigin);
    this.window = new BrowserWindow({
      ...createSecureWindowOptions(preloadPath, WORKBENCH_PARTITION),
      // Painted before the lifecycle document, so the window never flashes another theme.
      ...(appearance ? { backgroundColor: appearance.backgroundColor } : {}),
    });
    // The workbench covers the retained lifecycle renderer. Keep it responsive to
    // recovery and IPC while this window owns focus; throttle it again on blur.
    this.window.on("focus", () => this.window.webContents.setBackgroundThrottling(false));
    this.window.on("blur", () => this.window.webContents.setBackgroundThrottling(true));
    secureWebContents(this.window.webContents, {
      lifecycleUrl: this.lifecycleUrl,
      runtimeOrigin: () => null,
      openExternal: (url) => shell.openExternal(url),
    });
    this.#shown = new Promise((resolve) => {
      // The document already contains the styled startup screen. Remaining
      // resources must not keep that screen behind a hidden native window.
      this.window.webContents.once("dom-ready", () => {
        this.window.show();
        // Native visibility and content paint are separate startup evidence. Record
        // the explicit show result here; renderer visibility also allows hidden windows.
        logger.info(
          { event: "desktop.window.ready", visible: this.window.isVisible() },
          "Desktop startup window is ready",
        );
        resolve();
      });
    });
    this.window.contentView.on("bounds-changed", () => this.resizeWorkbench());
    const updateFullScreen = () => {
      for (const contents of this.webContents()) {
        contents.send(DESKTOP_CHANNELS.fullScreenChanged, this.window.isFullScreen());
      }
    };
    this.window.on("enter-full-screen", updateFullScreen);
    this.window.on("leave-full-screen", updateFullScreen);
    this.window.on("closed", () => this.#workbench?.webContents.close());
  }

  static async create(preloadPath: string, startupAppearance: () => DesktopStartupAppearance | undefined) {
    const rendererRoot = join(import.meta.dirname, "renderer");
    // The partition is memory-only; the lifecycle renderer stays mounted in the window.
    const workbenchSession = session.fromPartition(WORKBENCH_PARTITION, { cache: true });
    await workbenchSession.protocol.handle(LIFECYCLE_SCHEME, (request) =>
      readLifecycleAsset(request.url, rendererRoot, startupAppearance()),
    );
    return new DesktopWindowController(preloadPath, workbenchSession, startupAppearance());
  }

  runtimeOrigin() {
    return this.#runtimeOrigin;
  }

  webContents() {
    return [this.window.webContents, ...(this.#workbench ? [this.#workbench.webContents] : [])];
  }

  // Every frame in the windows this controller owns, with the process that hosts it.
  ownedFrames() {
    const owners = [
      { owner: "startup" as const, contents: this.window.webContents },
      ...(this.#workbench ? [{ owner: "workbench" as const, contents: this.#workbench.webContents }] : []),
    ];
    return owners.flatMap(({ owner, contents }) => {
      if (contents.isDestroyed()) return [];
      const mainFrame = contents.mainFrame;
      // Frames replaced by a navigation stay in the tree until their unload ends.
      return mainFrame.framesInSubtree
        .filter((frame) => !frame.detached)
        .map(
          (frame): OwnedFrame => ({
            owner,
            isMainFrame: frame === mainFrame,
            osProcessId: frame.osProcessId,
            url: frame.url,
          }),
        );
    });
  }

  updateState(state: DesktopState) {
    // The workbench shows the quit confirmation; the lifecycle page shows every other state.
    for (const contents of this.webContents()) contents.send(DESKTOP_CHANNELS.startupStateChanged, state);
  }

  setStartupAppearance(appearance: DesktopStartupAppearance) {
    this.window.setBackgroundColor(appearance.backgroundColor);
    this.window.webContents.send(DESKTOP_CHANNELS.startupAppearanceChanged, appearance);
  }

  executeCommand(commandId: string) {
    this.#workbench?.webContents.send(DESKTOP_CHANNELS.command, commandId);
  }

  async setTitleBarAppearance(appearance: TitleBarAppearance) {
    if (process.platform === "darwin") return;
    // Updating the hidden native overlay can suppress ready-to-show (ADR 0021).
    await this.#shown;
    this.window.setTitleBarOverlay(appearance);
  }

  private resizeWorkbench() {
    // Native window resize events can arrive before the content view has been laid out.
    const { width, height } = this.window.contentView.getBounds();
    this.#workbench?.setBounds({ x: 0, y: 0, width, height });
  }

  private createWorkbench() {
    const view = new WebContentsView({
      webPreferences: createSecureWindowOptions(this.preloadPath, WORKBENCH_PARTITION).webPreferences,
    });
    this.#workbench = view;
    secureWebContents(view.webContents, {
      lifecycleUrl: this.lifecycleUrl,
      runtimeOrigin: () => this.#runtimeOrigin,
      openExternal: (url) => shell.openExternal(url),
    });
    view.setVisible(false);
    this.window.contentView.addChildView(view);
    this.resizeWorkbench();
    return view;
  }

  async showQuitConfirmation(descriptor: RuntimeDescriptor) {
    // The confirmation is a dialog inside the workbench. A missing, crashed, or outdated
    // workbench loads again and then reads the confirmation state, so quitting never
    // waits on a dialog nobody can see.
    const contents = this.#workbench?.webContents;
    // The URL can commit before the document finishes loading. Join that load before revealing the view.
    if (
      this.#workbenchLoad ||
      !this.#workbench ||
      !contents ||
      contents.isCrashed() ||
      new URL(contents.getURL() || "about:blank").origin !== descriptor.origin
    ) {
      await this.showWorkbench(descriptor);
      return;
    }
    this.#workbench.setVisible(true);
    this.#workbench.webContents.focus();
  }

  async showLifecycle() {
    // Recovery must not wait for a new renderer, JavaScript bundle, or theme initialization.
    this.#workbench?.setVisible(false);
    if (this.window.webContents.getURL() !== this.lifecycleUrl) await this.window.loadURL(this.lifecycleUrl);
    const contents = this.#workbench?.getVisible() ? this.#workbench.webContents : this.window.webContents;
    contents.focus();
  }

  prepareWorkbench(descriptor: RuntimeDescriptor) {
    const loading = this.#loadRuntime(descriptor, () => this.#prepareWorkbenchAssets(descriptor));
    // Keep an early failure owned until showWorkbench joins this preparation.
    void loading.catch(() => {});
    return loading;
  }

  async showWorkbench(descriptor: RuntimeDescriptor) {
    const loading = this.#loadRuntime(descriptor, () => this.#loadWorkbench(descriptor));
    try {
      await loading;
      this.#workbench!.setVisible(true);
      this.#workbench!.webContents.focus();
    } finally {
      if (this.#workbenchLoad === loading) this.#workbenchLoad = undefined;
    }
  }

  #loadRuntime(descriptor: RuntimeDescriptor, load: () => Promise<void>) {
    if (this.#workbenchRuntimeId !== descriptor.instanceId) {
      const previous = this.#workbenchLoad;
      this.#workbenchRuntimeId = descriptor.instanceId;
      // A failed runtime can expose Retry before its early asset preparation has settled.
      this.#workbenchLoad = previous ? previous.catch(() => {}).then(load) : load();
    }
    this.#workbenchLoad ??= load();
    return this.#workbenchLoad;
  }

  async #loadWorkbench(descriptor: RuntimeDescriptor) {
    this.#runtimeOrigin = descriptor.origin;
    const [loginUrl] = await Promise.all([createRuntimeLoginUrl(fetch, descriptor), this.#shown]);
    const view = this.#workbench ?? this.createWorkbench();
    await view.webContents.loadURL(loginUrl);
  }

  async #prepareWorkbenchAssets(descriptor: RuntimeDescriptor) {
    this.#runtimeOrigin = descriptor.origin;
    // Show the startup window before a second renderer competes with its first paint.
    await this.#shown;
    const view = this.#workbench ?? this.createWorkbench();
    // The dashboard waits for this fragment during native bootstrap; it redeems it without reloading.
    await prepareWorkbenchDocument(view.webContents, descriptor);
  }
}
