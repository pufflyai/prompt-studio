import { spawn } from "node:child_process";

if (process.argv.includes("--descendant")) {
  process.on("SIGTERM", () => {
    process.stdout.write("terminated\n");
    process.exit(0);
  });
  process.stdout.write("ready\n");
  setInterval(() => {}, 1000);
} else {
  const child = spawn(process.execPath, [import.meta.filename, "--descendant"], {
    stdio: ["ignore", process.stdout, process.stderr],
  });
  process.stdout.write(`${child.pid}\n`);
  setInterval(() => {}, 1000);
}
