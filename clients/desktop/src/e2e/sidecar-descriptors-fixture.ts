import { readFileSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { createProcessObserver } from "../performance/process-observer";
import { spawnRuntimeProcess } from "../runtime/runtime-process";

const [root, bun, sidecar] = process.argv.slice(2);
const descriptors = `
const { readdirSync, readlinkSync } = require("node:fs");
const descriptors = () => JSON.stringify(readdirSync("/proc/self/fd").flatMap((fd) => {
  try { return [readlinkSync("/proc/self/fd/" + fd)]; } catch { return []; }
}));
`;

const launchRuntime = () => {
  const outputPath = join(root!, "runtime.log");
  const child = spawnRuntimeProcess(bun!, ["-e", `${descriptors}console.log(descriptors());`], {
    env: process.env,
    outputPath,
  });
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
};

// The observer answers one request on its pipe, like a process reading.
const launchObserver = async () => {
  const observer = createProcessObserver({
    executable: bun!,
    args: ["-e", `${descriptors}for await (const _ of console) { console.log(JSON.stringify(descriptors())); }`],
  });
  try {
    const output = await observer.read(process.pid, new AbortController().signal);
    process.send?.({ code: 0, output });
  } finally {
    await observer.close();
    app.quit();
  }
};

app.setPath("userData", join(root!, "profile"));
void app
  .whenReady()
  .then(async () => {
    process.stderr.write("Descriptor fixture: Electron ready\n");
    const window = new BrowserWindow({ show: false });
    await window.loadURL("data:text/html,<main>Descriptor ownership</main>");
    process.stderr.write("Descriptor fixture: window loaded\n");
    if (sidecar === "observer") await launchObserver();
    else launchRuntime();
  })
  .catch((error: unknown) => {
    process.stderr.write(String(error));
    app.exit(1);
  });
