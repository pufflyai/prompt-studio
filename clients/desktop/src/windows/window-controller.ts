import { join } from "node:path";
import { BrowserWindow, type Session, session, shell, WebContentsView } from "electron";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { DESKTOP_CHANNELS } from "../desktop-api";
import type { DesktopState } from "../lifecycle/lifecycle-machine";
import { secureSession, secureWebContents } from "../security/apply-window-security";
import { provisionRuntimeSession } from "../security/runtime-session";
import { createSecureWindowOptions } from "../security/window-security";
import { LIFECYCLE_SCHEME, LIFECYCLE_URL, readLifecycleAsset } from "./lifecycle-protocol";
import type { TitleBarAppearance } from "./title-bar-appearance";

const WORKBENCH_PARTITION = "pstdio-workbench";

export class DesktopWindowController {
  #runtimeOrigin: string | null = null;
  #workbench: WebContentsView | null = null;
  readonly #shown: Promise<void>;
  readonly lifecycleUrl: string;
  readonly window: BrowserWindow;

  private constructor(
    private readonly preloadPath: string,
    workbenchSession: Session,
  ) {
    this.lifecycleUrl = LIFECYCLE_URL;
    secureSession(workbenchSession);
    this.window = new BrowserWindow(createSecureWindowOptions(preloadPath, WORKBENCH_PARTITION));
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
        resolve();
      });
    });
    this.window.contentView.on("bounds-changed", () => this.resizeWorkbench());
    this.window.on("closed", () => this.#workbench?.webContents.close());
  }

  static async create(preloadPath: string) {
    const rendererRoot = join(import.meta.dirname, "renderer");
    // The partition is memory-only; the lifecycle renderer stays mounted in the window.
    const workbenchSession = session.fromPartition(WORKBENCH_PARTITION, { cache: true });
    await workbenchSession.protocol.handle(LIFECYCLE_SCHEME, (request) =>
      readLifecycleAsset(request.url, rendererRoot),
    );
    return new DesktopWindowController(preloadPath, workbenchSession);
  }

  runtimeOrigin() {
    return this.#runtimeOrigin;
  }

  webContents() {
    return [this.window.webContents, ...(this.#workbench ? [this.#workbench.webContents] : [])];
  }

  updateState(state: DesktopState) {
    this.window.webContents.send(DESKTOP_CHANNELS.startupStateChanged, state);
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

  async showQuitConfirmation() {
    await this.showLifecycle();
  }

  dismissQuitConfirmation() {
    this.#workbench?.setVisible(true);
    this.#workbench?.webContents.focus();
  }

  async showLifecycle() {
    // Recovery must not wait for a new renderer, JavaScript bundle, or theme initialization.
    this.#workbench?.setVisible(false);
    if (this.window.webContents.getURL() !== this.lifecycleUrl) await this.window.loadURL(this.lifecycleUrl);
    this.window.webContents.focus();
  }

  async showWorkbench(descriptor: RuntimeDescriptor) {
    // A child view must not cover the startup renderer before it shows the native window.
    await this.#shown;
    this.#runtimeOrigin = descriptor.origin;
    const view = this.#workbench ?? this.createWorkbench();
    await provisionRuntimeSession(view.webContents.session, descriptor);
    await view.webContents.loadURL(descriptor.origin);
    view.setVisible(true);
    view.webContents.focus();
  }
}
