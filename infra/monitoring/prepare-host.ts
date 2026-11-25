import { mkdir, writeFile } from "node:fs/promises";

if (process.platform !== "linux" || process.getuid?.() !== 0)
  throw new Error("Run host setup as root on the dedicated monitoring VM");

await import("./prepare-swap");

// Apply runtime tuning without changing cloud-init and replacing an existing VM.
const memory = ["MemoryHigh=256M", "MemorySwapMax=256M"];
const dropIn = "/etc/systemd/system/relay-monitoring.slice.d";
await mkdir(dropIn, { recursive: true });
await writeFile(`${dropIn}/memory.conf`, `[Slice]\n${memory.join("\n")}\n`);
for (const args of [["daemon-reload"], ["set-property", "--runtime", "relay-monitoring.slice", ...memory]])
  if (Bun.spawnSync(["systemctl", ...args], { stdout: "ignore", stderr: "pipe" }).exitCode !== 0)
    throw new Error("Cannot apply the monitoring memory reserve");

// This host uses one included disk and explicit mounts, with no modem or desktop disk manager.
for (const unit of ["multipathd.socket", "multipathd.service", "ModemManager.service", "udisks2.service"]) {
  const state = Bun.spawnSync(["systemctl", "show", "--property=LoadState", "--value", unit]);
  if (state.exitCode !== 0 || new TextDecoder().decode(state.stdout).trim() === "not-found") continue;
  if (Bun.spawnSync(["systemctl", "mask", "--now", unit], { stdout: "ignore", stderr: "pipe" }).exitCode !== 0)
    throw new Error("Cannot reserve memory for monitoring: " + unit);
}
const bootstrap = "oven/bun:1.4.4";
if (Bun.spawnSync(["docker", "image", "inspect", bootstrap], { stdout: "ignore", stderr: "ignore" }).exitCode === 0)
  // No force: an operator's running container keeps its image. Shared image layers remain available.
  Bun.spawnSync(["docker", "image", "rm", bootstrap], { stdout: "ignore", stderr: "ignore" });
