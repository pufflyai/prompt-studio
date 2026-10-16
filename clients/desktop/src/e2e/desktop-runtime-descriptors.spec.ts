import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { removeTestDirectory } from "../testing/remove-test-directory";

const require = createRequire(import.meta.url);

test("a Linux runtime does not inherit Electron resource descriptors", async () => {
  test.skip(process.platform !== "linux", "Linux descriptor inheritance");
  const root = mkdtempSync(join(tmpdir(), "desktop-runtime-descriptors-"));
  const entry = join(root, "main.mjs");
  const build = spawnSync("bun", [
    "build",
    join(import.meta.dirname, "runtime-descriptors-fixture.ts"),
    "--outfile",
    entry,
    "--target=node",
    "--format=esm",
    "--external=electron",
  ]);
  expect(build.status, build.stderr.toString()).toBe(0);
  const bun = spawnSync("bun", ["-e", "console.log(process.execPath)"], { encoding: "utf8" }).stdout.trim();
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require("electron") as string, [entry, root, bun], {
    env,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let stderr = "";
  child.stderr!.on("data", (data) => {
    stderr += data.toString();
  });
  try {
    const [message] = await Promise.race([
      once(child, "message"),
      once(child, "exit").then(() => {
        throw new Error(`Descriptor fixture exited: ${stderr}`);
      }),
    ]);
    expect(message.code, message.output).toBe(0);
    const descriptors = JSON.parse(message.output) as string[];
    expect(
      descriptors.filter((target) =>
        /icudtl\.dat|v8_context_snapshot|\.pak$|\/profile\/|memfd:(wayland|pulseaudio)|org\.chromium/.test(target),
      ),
    ).toEqual([]);
  } finally {
    await test.info().attach("descriptor-fixture.log", { body: stderr, contentType: "text/plain" });
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    }
    await removeTestDirectory(root);
  }
});
