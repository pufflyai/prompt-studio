import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, net, type Session, session, shell } from "electron";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { secureSession, secureWebContents } from "../security/apply-window-security";
import { provisionRuntimeSession } from "../security/runtime-session";
import { createSecureWindowOptions } from "../security/window-security";
import { LIFECYCLE_SCHEME, LIFECYCLE_URL, resolveLifecycleAssetPath } from "./lifecycle-protocol";

const WORKBENCH_PARTITION = "pstdio-workbench";

export class DesktopWindowController {
  #runtimeOrigin: string | null = null;
  readonly lifecycleUrl: string;
  readonly window: BrowserWindow;

  private constructor(preloadPath: string, workbenchSession: Session) {
    this.lifecycleUrl = LIFECYCLE_URL;
    secureSession(workbenchSession);
    this.window = new BrowserWindow(createSecureWindowOptions(preloadPath, WORKBENCH_PARTITION));
    secureWebContents(this.window.webContents, {
      lifecycleUrl: this.lifecycleUrl,
      runtimeOrigin: () => this.#runtimeOrigin,
      openExternal: (url) => shell.openExternal(url),
    });
    this.window.once("ready-to-show", () => this.window.show());
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

  async showLifecycle() {
    await this.window.loadURL(this.lifecycleUrl);
  }

  async showWorkbench(descriptor: RuntimeDescriptor) {
    this.#runtimeOrigin = descriptor.origin;
    await provisionRuntimeSession(this.window.webContents.session, descriptor);
    await this.window.loadURL(descriptor.origin);
  }
}
