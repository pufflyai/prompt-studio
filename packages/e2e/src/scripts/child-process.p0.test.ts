import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { stopChildProcess } from "./child-process";

describe("stopChildProcess", () => {
  test("waits until the child has finished its shutdown handler", async () => {
    const child = spawn(
      process.execPath,
      [
        "-e",
        [
          'process.on("SIGTERM", () => setTimeout(() => process.exit(0), 50));',
          'process.stdout.write("ready\\n");',
          "setInterval(() => {}, 1000);",
        ].join(""),
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );

    await once(child.stdout, "data");
    await stopChildProcess(child);

    expect(child.exitCode).toBe(0);
  });
});
