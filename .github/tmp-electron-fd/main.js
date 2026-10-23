const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: true });
  await win.loadURL("data:text/html,<h1>hi</h1>");
  console.log("READY");
  if (process.env.SPAWN === "1") {
    setTimeout(() => {
      const child = spawn("sleep", ["600"], { stdio: ["pipe", "pipe", "ignore"] });
      console.log("CHILD", child.pid);
    }, 3000);
  }
});
