import { withFileMutationLock } from "pstdio-paths";
import { runPreparationCommand } from "./preparation-command";
import { publishPreparationEvent, startPreparationWorker } from "./preparation-server";

let sequence = 0;
startPreparationWorker(async (task, data, signal) => {
  const input = data as { name?: string; url: string; path: string };
  const spin = () => {
    publishPreparationEvent({ entered: task });
    while (true) Math.sqrt(Math.random());
  };
  if (task === "spin") spin();
  if (task === "lock-spin") withFileMutationLock(input.path, spin);
  if (task === "child-spin" || task === "stdin-child-spin") {
    void runPreparationCommand({
      argv: [
        process.execPath,
        "-e",
        `const path = ${task === "stdin-child-spin" ? "(await Bun.stdin.json()).path" : JSON.stringify(input.path)}; require('node:fs').writeFileSync(path, String(process.pid)); setInterval(() => {}, 1000);`,
      ],
      cwd: process.cwd(),
      ...(task === "stdin-child-spin" ? { stdin: JSON.stringify({ path: input.path }) } : {}),
    });
    spin();
  }
  if (task === "reject") throw new Error("preparation failed");
  if (task === "exit") process.exit(9);
  if (task === "wait") {
    publishPreparationEvent({ entered: input.name });
    await fetch(input.url, { signal });
  }
  if (task === "busy") {
    publishPreparationEvent({ entered: "busy" });
    const end = performance.now() + 100;
    while (performance.now() < end) Math.sqrt(Math.random());
  }
  if (task === "hang") {
    publishPreparationEvent({ entered: "hang" });
    await new Promise(() => {});
  }
  signal.throwIfAborted();
  return { name: input.name, sequence: ++sequence };
});
