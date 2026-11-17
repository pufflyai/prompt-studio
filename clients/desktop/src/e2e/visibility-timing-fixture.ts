import { app, BrowserWindow } from "electron";

void app.whenReady().then(() => {
  const window = new BrowserWindow({ width: 320, height: 240 });
  void window.loadURL("data:text/html,<main>Visibility timing</main>");
});
