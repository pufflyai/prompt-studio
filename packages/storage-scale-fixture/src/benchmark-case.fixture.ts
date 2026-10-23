import { spawn } from "node:child_process";
import { writeSync } from "node:fs";
import { completeBenchmarkWorker } from "./benchmark-case";

const emit = (row: object) => writeSync(1, `${JSON.stringify(row)}\n`);
await completeBenchmarkWorker(async () => {
  const mode = process.argv[2];
  if (mode === "success") return;
  if (mode === "unexpected-exit") process.exit(0);
  if (mode === "failure") throw new Error("Expected fixture failure");
  if (["descendants", "exit-with-descendants", "fail-with-descendants"].includes(mode)) {
    const children = [false, process.platform !== "win32"].map((detached) =>
      spawn(process.execPath, ["-e", "while(true) {}"], { detached, stdio: "ignore" }),
    );
    emit({ pids: children.map((child) => child.pid) });
    if (mode === "exit-with-descendants") return;
    if (mode === "fail-with-descendants") throw new Error("Expected failure with descendants");
  } else if (mode === "progress") {
    setInterval(() => emit({ phase: "progress" }), 10);
    await new Promise(() => {});
  } else emit({ phase: mode === "setup" ? "setup-start" : "setup-complete" });
  while (true) {}
});
