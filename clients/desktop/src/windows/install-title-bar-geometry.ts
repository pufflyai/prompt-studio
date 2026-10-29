import { ipcRenderer, webFrame } from "electron";
import { DESKTOP_CHANNELS } from "../desktop-api";
import type { TitleBarGeometry } from "./title-bar-geometry";

interface WindowControlsOverlay extends EventTarget {
  visible: boolean;
  getTitlebarAreaRect: () => DOMRect;
}

export const installTitleBarGeometry = () => {
  if (location.protocol === "pstdio:") {
    const overlay = (navigator as Navigator & { windowControlsOverlay: WindowControlsOverlay }).windowControlsOverlay;
    const report = () => {
      const rect = overlay.getTitlebarAreaRect();
      const zoom = webFrame.getZoomFactor();
      void ipcRenderer.invoke(DESKTOP_CHANNELS.titleBarGeometry, {
        x: overlay.visible ? rect.x * zoom : 0,
        width: (overlay.visible ? rect.width : innerWidth) * zoom,
      });
    };
    ipcRenderer.on(DESKTOP_CHANNELS.requestTitleBarGeometry, report);
    overlay.addEventListener("geometrychange", report);
    window.addEventListener("resize", report);
    report();
    return () => {
      ipcRenderer.removeListener(DESKTOP_CHANNELS.requestTitleBarGeometry, report);
      overlay.removeEventListener("geometrychange", report);
      window.removeEventListener("resize", report);
    };
  }

  const apply = (_event: Electron.IpcRendererEvent, geometry: TitleBarGeometry) => {
    const zoom = webFrame.getZoomFactor();
    document.documentElement.style.setProperty("--pstdio-title-bar-area-x", `${geometry.x / zoom}px`);
    document.documentElement.style.setProperty("--pstdio-title-bar-area-width", `${geometry.width / zoom}px`);
  };
  const request = () => void ipcRenderer.invoke(DESKTOP_CHANNELS.requestTitleBarGeometry);
  ipcRenderer.on(DESKTOP_CHANNELS.titleBarGeometryChanged, apply);
  window.addEventListener("resize", request);
  // A newly mounted or reloaded view needs the current geometry even when the
  // native window has not resized. The native document remains the sole owner.
  request();
  return () => {
    ipcRenderer.removeListener(DESKTOP_CHANNELS.titleBarGeometryChanged, apply);
    window.removeEventListener("resize", request);
  };
};
