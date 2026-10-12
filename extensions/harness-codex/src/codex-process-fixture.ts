import { spawn } from "node:child_process";

if (process.argv.includes("--descendant")) setInterval(() => {}, 1000);
else {
  const child = spawn(process.execPath, [import.meta.filename, "--descendant"], {
    stdio: ["ignore", process.stdout, process.stderr],
  });
  console.log(child.pid);
  setInterval(() => {}, 1000);
}
