import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

const startFixture = () => {
  const child = spawn(
    process.execPath,
    ["--conditions=source", join(import.meta.dirname, "remote-session-browser.fixture.ts")],
    {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PSTDIO_"))),
        NODE_ENV: "production",
      },
    },
  );
  let output = "";
  let root: string | undefined;
  const ready = new Promise<{ origin: string; root: string; projectId: string; sessionId: string }>(
    (resolve, reject) => {
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
        const line = output.split("\n").find((line) => line.startsWith("REMOTE_SESSION_FIXTURE "));
        if (line) {
          const fixture = JSON.parse(line.slice("REMOTE_SESSION_FIXTURE ".length));
          root = fixture.root;
          resolve(fixture);
        }
      });
      child.stderr.on("data", (chunk) => {
        output += chunk.toString();
      });
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`Fixture exited ${code}: ${output}`)));
    },
  );
  return {
    ready,
    output: () => output,
    stop: async () => {
      const exited = once(child, "close");
      // Windows terminates SIGTERM recipients without running their signal handler.
      child.stdin.end("shutdown\n");
      return exited;
    },
    cleanup: async () => {
      // A failing regression must not retain its subprocess or isolated database directory.
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "close");
        child.kill("SIGKILL");
        await exited;
      }
      if (root) await rm(root, { recursive: true, force: true });
      console.log(output);
    },
  };
};
const fixtureAction = (origin: string, action: string) =>
  fetch(`${origin}/fixture/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });

test("remote browser mirror recovers from delivery failure and releases owned resources", async () => {
  const fixture = startFixture();
  try {
    const { origin, root } = await fixture.ready;
    const failed = await fixtureAction(origin, "fail-mirror");
    expect(failed.status).toBe(500);
    expect(await failed.text()).toContain("Injected mirror delivery failure");
    const recovered = await fixtureAction(origin, "online");
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).online).toBe(true);
    // A detached delivery failure must be observed without poisoning cleanup.
    expect((await fixtureAction(origin, "fail-background-mirror")).status).toBe(200);
    expect(await fixture.stop()).toEqual([0, null]);
    expect(fixture.output()).toContain('"phase":"source-close"');
    expect(fixture.output()).toContain('"phase":"target-close"');
    expect(fixture.output()).toContain('"phase":"complete"');
    expect(fixture.output()).toContain('"event":"fixture.remote_session.mirror_failed"');
    expect(existsSync(root)).toBe(false);
  } finally {
    await fixture.cleanup();
  }
});

test("remote browser cleanup attempts later resources and reports a failed app close", async () => {
  const fixture = startFixture();
  try {
    const { origin, root } = await fixture.ready;
    expect((await fixtureAction(origin, "fail-source-close")).status).toBe(200);
    expect(await fixture.stop()).toEqual([1, null]);
    const output = fixture.output();
    expect(output).toContain('"phase":"source-close"');
    expect(output).toContain('"phase":"target-close"');
    expect(output).toContain('"phase":"manager-close"');
    expect(output).toContain('"phase":"root-remove"');
    expect(output).toContain('"phase":"complete"');
    expect(output).toContain('"event":"fixture.remote_session.cleanup_failed"');
    expect(output).toContain("Injected source close failure");
    expect(existsSync(root)).toBe(false);
  } finally {
    await fixture.cleanup();
  }
});

test("browser queue failure injection crosses the owner relay and recovers its saved checkpoint", async () => {
  const fixture = startFixture();
  try {
    const { origin, projectId, sessionId } = await fixture.ready;
    expect((await fixtureAction(origin, "queue-unavailable")).ok).toBe(true);
    const url = `${origin}/v1/sessions/${sessionId}/queued-messages?projectId=${projectId}`;
    for (let read = 0; read < 2; read++) {
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      expect((await response.json()).queue.readOnly).toBe(true);
    }
    expect((await (await fetch(`${origin}/fixture/state`)).json()).failedQueueReads).toBeGreaterThanOrEqual(2);
    expect((await fixtureAction(origin, "queue-available")).ok).toBe(true);
    expect((await (await fetch(url)).json()).queue.readOnly).not.toBe(true);
    expect(await fixture.stop()).toEqual([0, null]);
  } finally {
    await fixture.cleanup();
  }
});
