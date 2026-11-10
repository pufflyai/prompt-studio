import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const [mode, directory, behavior] = process.argv.slice(2);
if (!directory) throw new Error("Fixture directory required.");
writeFileSync(join(directory, `${mode}.pid`), String(process.pid));

if (mode === "launcher") {
  const child = spawn(process.execPath, [import.meta.filename, "native", directory, behavior!], {
    stdio: behavior === "leader-first" ? "ignore" : ["pipe", "inherit", "inherit"],
    windowsHide: true,
  });
  // A launcher need not forward shutdown signals to the native executable.
  process.on("SIGTERM", () => {});
  if (behavior === "leader-first") {
    while (!existsSync(join(directory, "ready"))) await Bun.sleep(5);
    for await (const line of createInterface({ input: process.stdin })) {
      const request = JSON.parse(line);
      const response =
        request.request.subtype === "initialize" ? {} : { rate_limits: { five_hour: { utilization: 25 } } };
      console.log(
        JSON.stringify({
          type: "control_response",
          response: { subtype: "success", request_id: request.request_id, response },
        }),
      );
      if (request.request.subtype === "get_usage") process.exit(0);
    }
  }
  child.stdin!.on("error", () => {});
  process.stdin.pipe(child.stdin!);
  child.once("exit", () => process.exit(0));
} else {
  setInterval(() => {}, 1000);
  process.on("SIGTERM", () => {
    if (["stubborn", "leader-first"].includes(behavior!)) return;
    writeFileSync(join(directory, "terminated"), "native stopped");
    process.exit(0);
  });
  writeFileSync(join(directory, "ready"), "ready");
  for await (const line of createInterface({ input: process.stdin })) {
    const request = JSON.parse(line);
    if (request.type !== "control_request") process.exit(2);
    const response =
      request.request.subtype === "initialize" ? {} : { rate_limits: { five_hour: { utilization: 25 } } };
    console.log(
      JSON.stringify({
        type: "control_response",
        response: { subtype: "success", request_id: request.request_id, response },
      }),
    );
  }
}
