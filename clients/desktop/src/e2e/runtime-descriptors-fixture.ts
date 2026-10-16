import { readFileSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { spawnRuntimeProcess } from "../runtime/runtime-process";

const [root, bun] = process.argv.slice(2);
app.setPath("userData", join(root!, "profile"));
void app
  .whenReady()
  .then(async () => {
    process.stderr.write("Descriptor fixture: Electron ready\n");
    const window = new BrowserWindow({ show: false });
    await window.loadURL("data:text/html,<main>Descriptor ownership</main>");
    process.stderr.write("Descriptor fixture: window loaded\n");
    const outputPath = join(root!, "runtime.log");
    const probe = `
import { readdirSync, readlinkSync } from "node:fs";
const targets = readdirSync("/proc/self/fd").flatMap((fd) => {
  try { return [readlinkSync("/proc/self/fd/" + fd)]; } catch { return []; }
});
console.log(JSON.stringify(targets));
`;
    const child = spawnRuntimeProcess(bun!, ["-e", probe], { env: process.env, outputPath });
    child.once("spawn", () => process.stderr.write(`Descriptor fixture: child ${child.pid} started\n`));
    child.once("exit", (code) => process.stderr.write(`Descriptor fixture: child exited ${code}\n`));
    child.on("error", (error) => {
      process.send?.({ error: error.message });
      app.exit(1);
    });
    child.once("close", (code) => {
      process.send?.({ code, output: readFileSync(outputPath, "utf8") });
      app.quit();
    });
  })
  .catch((error: unknown) => {
    process.stderr.write(String(error));
    app.exit(1);
  });
