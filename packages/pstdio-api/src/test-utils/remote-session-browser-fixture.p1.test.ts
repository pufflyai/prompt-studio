import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

test("remote browser mirror recovers from delivery failure and releases owned resources", async () => {
  const child = spawn(
    process.execPath,
    ["--conditions=source", join(import.meta.dirname, "remote-session-browser.fixture.ts")],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PSTDIO_"))),
    },
  );
  let output = "";
  let root: string | undefined;
  const ready = new Promise<{ origin: string; root: string }>((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const line = output.split("\n").find((line) => line.startsWith("REMOTE_SESSION_FIXTURE "));
      if (line) resolve(JSON.parse(line.slice("REMOTE_SESSION_FIXTURE ".length)));
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Fixture exited ${code}: ${output}`)));
  });
  try {
    const fixture = await ready;
    root = fixture.root;
    const action = (action: string) =>
      fetch(`${fixture.origin}/fixture/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
    const failed = await action("fail-mirror");
    expect(failed.status).toBe(500);
    expect(await failed.text()).toContain("Injected mirror delivery failure");
    const recovered = await action("online");
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).online).toBe(true);
    // A detached delivery failure must be observed without poisoning the next action or cleanup.
    expect((await action("fail-background-mirror")).status).toBe(200);
    const exited = once(child, "close");
    child.kill("SIGTERM");
    expect(await exited).toEqual([0, null]);
    expect(output).toContain('"phase":"source-close"');
    expect(output).toContain('"phase":"target-close"');
    expect(output).toContain('"phase":"complete"');
    expect(output).toContain('"event":"fixture.remote_session.mirror_failed"');
    expect(existsSync(root)).toBe(false);
  } finally {
    // A failing regression must not retain its subprocess or its isolated database directory.
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "close");
      child.kill("SIGKILL");
      await exited;
    }
    if (root) await rm(root, { recursive: true, force: true });
    console.log(output);
  }
});
