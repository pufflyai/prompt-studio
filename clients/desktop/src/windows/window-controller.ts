import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, net, type Session, session, shell, WebContentsView } from "electron";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { secureSession, secureWebContents } from "../security/apply-window-security";
import { provisionRuntimeSession } from "../security/runtime-session";
import { createSecureWindowOptions } from "../security/window-security";
import { LIFECYCLE_SCHEME, LIFECYCLE_URL, resolveLifecycleAssetPath } from "./lifecycle-protocol";

const WORKBENCH_PARTITION = "pstdio-workbench";

export class DesktopWindowController {
  #runtimeOrigin: string | null = null;
  #confirmation: WebContentsView | null = null;
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
      runtimeOrigin: () => this.#runtimeOrigin,
      openExternal: (url) => shell.openExternal(url),
    });
    this.window.once("ready-to-show", () => this.window.show());
    this.window.on("resize", () => this.resizeConfirmation());
    this.window.on("closed", () => this.closeConfirmation());
  }

  static async create(preloadPath: string) {
    const rendererRoot = join(import.meta.dirname, "renderer");
    // The partition is memory-only. Keeping its cache warm lets recovery reuse the lifecycle bundle.
    const workbenchSession = session.fromPartition(WORKBENCH_PARTITION, { cache: true });
    await workbenchSession.protocol.handle(LIFECYCLE_SCHEME, (request) => {
      const assetPath = resolveLifecycleAssetPath(request.url, rendererRoot);
      return assetPath ? net.fetch(pathToFileURL(assetPath).href) : new Response(null, { status: 404 });
    });
    return new DesktopWindowController(preloadPath, workbenchSession);
  }

  runtimeOrigin() {
    return this.#runtimeOrigin;
  }

  webContents() {
    return [this.window.webContents, ...(this.#confirmation ? [this.#confirmation.webContents] : [])];
  }

  private resizeConfirmation() {
    const [width, height] = this.window.getContentSize();
    this.#confirmation?.setBounds({ x: 0, y: 0, width, height });
  }

  private closeConfirmation() {
    this.#confirmation?.webContents.close();
    this.#confirmation = null;
  }

  async showQuitConfirmation() {
    const view = new WebContentsView({
      webPreferences: createSecureWindowOptions(this.preloadPath, WORKBENCH_PARTITION).webPreferences,
    });
    this.#confirmation = view;
    secureWebContents(view.webContents, {
      lifecycleUrl: this.lifecycleUrl,
      runtimeOrigin: () => null,
      openExternal: (url) => shell.openExternal(url),
    });
    // A separate view keeps the workbench and its live connections mounted during confirmation.
    this.window.contentView.addChildView(view);
    this.resizeConfirmation();
    await view.webContents.loadURL(this.lifecycleUrl);
    view.webContents.focus();
  }

  dismissQuitConfirmation() {
    if (this.#confirmation) this.window.contentView.removeChildView(this.#confirmation);
    this.closeConfirmation();
    this.window.webContents.focus();
  }

  async showLifecycle() {
    this.dismissQuitConfirmation();
    await this.window.loadURL(this.lifecycleUrl);
  }

  async showWorkbench(descriptor: RuntimeDescriptor) {
    this.#runtimeOrigin = descriptor.origin;
    await provisionRuntimeSession(this.window.webContents.session, descriptor);
    await this.window.loadURL(descriptor.origin);
  }
}
