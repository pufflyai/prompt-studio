import { mkdir, open, stat } from "node:fs/promises";

if (process.platform !== "linux" || process.getuid?.() !== 0)
  throw new Error("Run disk setup as root on the monitoring VM");
const command = (args: string[]) => {
  const child = Bun.spawnSync(args, { stdout: "pipe", stderr: "pipe" });
  if (child.exitCode !== 0) throw new Error("Monitoring disk setup failed: " + args[0]);
};
const allocations = [
  ["prometheus", 768, 65534],
  ["loki", 768, 10001],
  ["alloy", 384, 0],
  ["checkpoint", 128, 1000],
] as const;
const images = "/var/lib/relay-monitoring-disks";
await mkdir(images, { recursive: true, mode: 0o700 });
for (const [name, mib, owner] of allocations) {
  const image = images + "/" + name + ".img";
  const target = "/opt/relay-monitoring/state/" + name;
  await mkdir(target, { recursive: true });
  let exists = true;
  try {
    await stat(image);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    exists = false;
  }
  if (!exists) {
    const file = await open(image, "wx", 0o600);
    await file.close();
    command(["fallocate", "--length", String(mib) + "M", image]);
    command(["mkfs.ext4", "-q", "-E", "nodiscard", "-m", "0", image]);
  }
  // Existing media is never reformatted, even when unreadable or full.
  const format = Bun.spawnSync(["blkid", "-s", "TYPE", "-o", "value", image]);
  if (format.exitCode !== 0 || new TextDecoder().decode(format.stdout).trim() !== "ext4")
    throw new Error("Existing monitoring disk needs operator recovery: " + name);
  // Formatting/discard or restored sparse files must not surrender the root-space reservation.
  command(["fallocate", "--length", String(mib) + "M", image]);
  if (Bun.spawnSync(["mountpoint", "--quiet", target]).exitCode !== 0)
    command(["mount", "-o", "loop,noatime", image, target]);
  const mounted = Bun.spawnSync(["findmnt", "--noheadings", "--output", "SOURCE", "--mountpoint", target]);
  const device = new TextDecoder().decode(mounted.stdout).trim();
  const backing = Bun.spawnSync(["losetup", "--noheadings", "--output", "BACK-FILE", device]);
  if (mounted.exitCode !== 0 || backing.exitCode !== 0 || new TextDecoder().decode(backing.stdout).trim() !== image)
    throw new Error("Unexpected monitoring mount; recover it before starting: " + name);
  command(["chown", String(owner) + ":" + String(owner), target]);
  command(["chmod", "0700", target]);
}
