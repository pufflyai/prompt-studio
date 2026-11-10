import { ipcRenderer } from "electron";
import { DESKTOP_CHANNELS } from "../desktop-api";
import { observeStartupPaint } from "../windows/observe-startup-paint";

observeStartupPaint(() => {
  // Hold the real paint receipt to prove workbench loading depends on it.
  ipcRenderer.once("fixture:release-paint", () => ipcRenderer.send(DESKTOP_CHANNELS.startupPainted));
  ipcRenderer.send("fixture:paint-ready");
});
