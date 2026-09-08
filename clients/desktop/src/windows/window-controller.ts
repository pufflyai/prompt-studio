import { join } from "node:path";
import { BrowserWindow, type Session, session, shell, WebContentsView } from "electron";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { createLogger } from "pstdio-logging";
import { DESKTOP_CHANNELS } from "../desktop-api";
import type { DesktopState } from "../lifecycle/lifecycle-machine";
import { secureSession, secureWebContents } from "../security/apply-window-security";
import { provisionRuntimeSession } from "../security/runtime-session";
import { createSecureWindowOptions } from "../security/window-security";
import { LIFECYCLE_SCHEME, LIFECYCLE_URL, readLifecycleAsset } from "./lifecycle-protocol";

const profile = createLogger({
  component: "desktop-window-profile",
  level: "info",
  service: "pstdio-desktop",
  sync: true,
});
const phase = (phase: string) => profile.info({ event: "desktop.window.profile", phase }, "Desktop window profile");

const WORKBENCH_PARTITION = "pstdio-workbench";

export class DesktopWindowController {
  #runtimeOrigin: string | null = null;
  #workbench: WebContentsView | null = null;
  readonly lifecycleUrl: string;
  readonly window: BrowserWindow;

  private constructor(
    private readonly preloadPath: string,
    workbenchSession: Session,
  ) {
    this.lifecycleUrl = LIFECYCLE_URL;
    phase("security.begin");
    secureSession(workbenchSession);
    phase("security.ready");
    this.window = new BrowserWindow(createSecureWindowOptions(preloadPath, WORKBENCH_PARTITION));
    phase("native.created");
    secureWebContents(this.window.webContents, {
      lifecycleUrl: this.lifecycleUrl,
      runtimeOrigin: () => null,
      openExternal: (url) => shell.openExternal(url),
    });
    this.window.once("ready-to-show", () => this.window.show());
    this.window.on("resize", () => this.resizeWorkbench());
    this.window.on("closed", () => this.#workbench?.webContents.close());
  }

  static async create(preloadPath: string) {
    phase("controller.begin");
    const rendererRoot = join(import.meta.dirname, "renderer");
    // The partition is memory-only; the lifecycle renderer stays mounted in the window.
    const workbenchSession = session.fromPartition(WORKBENCH_PARTITION, { cache: true });
    phase("session.created");
    await workbenchSession.protocol.handle(LIFECYCLE_SCHEME, (request) =>
      readLifecycleAsset(request.url, rendererRoot),
    );
    phase("protocol.ready");
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

  private resizeWorkbench() {
    const [width, height] = this.window.getContentSize();
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
    this.#runtimeOrigin = descriptor.origin;
    const view = this.#workbench ?? this.createWorkbench();
    await provisionRuntimeSession(view.webContents.session, descriptor);
    await view.webContents.loadURL(descriptor.origin);
    view.setVisible(true);
    view.webContents.focus();
  }
}
