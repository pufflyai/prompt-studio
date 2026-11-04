/**
 * Real relay / PostgreSQL / object-store CPU comparison, with separate device processes.
 * bun --conditions=source packages/e2e/src/perf/cloud-sync-cpu.diagnostic.ts <relay-image> <output.json> [seconds-per-phase=3600]
 * The apps use disposable test databases and deterministic conversation patches, not paid agent calls.
 */

import { mkdir } from "node:fs/promises";
import { cpus, release } from "node:os";
import { dirname, join } from "node:path";
import { deploy } from "./relay-reference-workload/deployment";

const [image, output, seconds = "3600", selection = "all"] = process.argv.slice(2);
if (!image || !output || !Number.isFinite(Number(seconds)) || Number(seconds) <= 0)
  throw new Error("Expected relay image, output JSON path and positive seconds per phase");
if (!["all", "idle"].includes(selection)) throw new Error("Expected all or idle phase selection");
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
const deployment = await deploy(image, console.error, controller.signal);
const projectId = crypto.randomUUID();
const manager = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    if (new URL(request.url).pathname.endsWith("/keys"))
      return Response.json({
        project: [{ generation: 1, secret: "A".repeat(43) }],
        personal: [{ generation: 1, secret: "B".repeat(43) }],
      });
    const device = request.headers.get("authorization")!.slice(7);
    const token = await deployment.token("owner", projectId, device);
    return Response.json({ token, expiresAt: new Date(Date.now() + 300_000).toISOString() });
  },
});
const workers: ReturnType<typeof Bun.spawn>[] = [];
const devices: { ready: string; deviceId: string; sessions: string[] }[] = [];
const command = async (device: (typeof devices)[number], action: string, id?: string) => {
  const response = await fetch(device.ready, { method: "POST", body: JSON.stringify({ action, id }) });
  if (!response.ok) throw new Error(`Worker ${action} failed`);
  return response.json();
};
const wait = (ms: number) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    controller.signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(controller.signal.reason);
      },
      { once: true },
    );
  });
const phases: { name: string; devices: { cpuPercent: number; [key: string]: unknown }[] }[] = [];
try {
  for (const role of ["source", "reader"]) {
    const child = Bun.spawn(
      [
        process.execPath,
        ...(process.env.SYNC_CPU_PROFILE_DIR
          ? ["--cpu-prof", `--cpu-prof-dir=${process.env.SYNC_CPU_PROFILE_DIR}`, `--cpu-prof-name=${role}.cpuprofile`]
          : []),
        "--conditions=source",
        join(import.meta.dir, "../../../pstdio-api/src/services/personal-history/sync-cpu-worker.diagnostic.ts"),
        role,
        manager.url.origin,
        deployment.origin,
        projectId,
      ],
      { stdout: "pipe", stderr: "inherit" },
    );
    workers.push(child);
    const reader = child.stdout.getReader();
    let text = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("CPU worker stopped before readiness");
      text += new TextDecoder().decode(chunk.value);
      const ready = text.split("\n").find((line) => line.startsWith('{"ready":'));
      if (ready) {
        devices.push(JSON.parse(ready));
        break;
      }
    }
    // Drain logs without retaining them or blocking the worker pipe.
    void (async () => {
      while (!(await reader.read()).done) {}
    })();
  }
  const settle = async () => {
    const end = Date.now() + 120_000;
    while (true) {
      const states = await Promise.all(devices.map((device) => command(device, "status")));
      if (states.every((state) => state.state === "synced")) return;
      if (Date.now() > end) throw new Error(`Sync did not settle: ${JSON.stringify(states)}`);
      await wait(1000);
    }
  };
  const sample = async (name: string, duration = Number(seconds)) => {
    await Promise.all(devices.map((device) => command(device, "start")));
    console.error(`Measuring ${name} for ${duration}s`);
    await wait(duration * 1000);
    const result = { name, devices: await Promise.all(devices.map((device) => command(device, "sample"))) };
    phases.push(result);
    await mkdir(dirname(output), { recursive: true });
    await Bun.write(output, JSON.stringify({ phases, partial: true }, null, 2));
  };
  if (selection === "all") {
    await sample("stream-off");
    await Promise.all(devices.map((device) => command(device, "on")));
    await settle();
    await sample("stream-on-unread");
    await command(devices[1]!, "watch", devices[0]!.sessions[0]);
    await sample("stream-on-reading", Math.min(60, Number(seconds)));
    await command(devices[1]!, "unwatch");
  } else await Promise.all(devices.map((device) => command(device, "on")));
  // Finalize the same real conversations before idle; include its CPU/durable work separately.
  await Promise.all(devices.map((device) => command(device, "start")));
  await Promise.all(devices.map((device) => command(device, "idle")));
  await settle();
  phases.push({
    name: "finalization-on",
    devices: await Promise.all(devices.map((device) => command(device, "sample"))),
  });
  await sample("idle-on");
  await Promise.all(devices.map((device) => command(device, "off")));
  await sample("idle-off");
  const byName = (name: string, device: number) =>
    phases.find((phase) => phase.name === name)!.devices[device]!.cpuPercent;
  const overhead = {
    sourceStreaming: selection === "all" ? byName("stream-on-unread", 0) - byName("stream-off", 0) : null,
    background: selection === "all" ? byName("stream-on-unread", 1) - byName("stream-off", 1) : null,
    idle: [0, 1].map((device) => byName("idle-on", device) - byName("idle-off", device)),
  };
  await Bun.write(
    output,
    JSON.stringify(
      {
        metadata: {
          bun: Bun.version,
          os: release(),
          cpu: cpus()[0]?.model,
          secondsPerPhase: Number(seconds),
          selection,
          profiled: Boolean(process.env.SYNC_CPU_PROFILE_DIR),
          transitions: "Each source conversation advances to a new message every 20 seconds and finishes before idle.",
          relay: await deployment.metadata(),
          sessions: 2003,
          extensions: 25,
          limitations: [
            "Disposable API test databases, deterministic conversation updates, fixture manager keys and signed relay identities; excludes desktop renderer and paid agent subprocesses.",
            ...(Number(seconds) < 3600
              ? ["Short diagnostic; does not establish the one-hour acceptance scenarios."]
              : []),
          ],
        },
        phases,
        overhead,
        cpuPassed:
          (overhead.sourceStreaming ?? 0) <= 1 &&
          (overhead.background ?? 0) <= 0.5 &&
          overhead.idle.every((value) => value <= 0.2),
      },
      null,
      2,
    ),
  );
} finally {
  for (const child of workers) child.kill("SIGTERM");
  await Promise.all(workers.map((child) => child.exited));
  await manager.stop(true);
  await deployment.close();
}
