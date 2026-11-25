import { appendFile, chmod, lstat, mkdir, open, readFile, statfs } from "node:fs/promises";

if (process.platform !== "linux" || process.getuid?.() !== 0)
  throw new Error("Run swap setup as root on the dedicated monitoring VM");

const path = "/var/lib/relay-monitoring/monitoring.swap";
const bytes = 256 * 1024 * 1024;
const fstab = await readFile("/etc/fstab", "utf8");
const entry = `${path} none swap sw 0 0`;
const entries = fstab.split("\n").filter((line) => line.trim().split(/\s+/)[0] === path);
if (entries.length && (entries.length !== 1 || entries[0]?.trim() !== entry))
  throw new Error("Unexpected monitoring swap fstab entry");
const run = (args: string[]) => {
  const result = Bun.spawnSync(args, { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error("Monitoring swap operation failed: " + args[0]);
  return new TextDecoder().decode(result.stdout).trim();
};
await mkdir("/var/lib/relay-monitoring", { recursive: true, mode: 0o700 });
if (run(["findmnt", "--noheadings", "--output", "FSTYPE", "--target", path.replace(/\/[^/]+$/, "")]) !== "ext4")
  throw new Error("Monitoring swap requires the dedicated ext4 root disk");
let existing = await lstat(path).catch((error: NodeJS.ErrnoException) => {
  if (error.code !== "ENOENT") throw error;
  return undefined;
});
const disk = await statfs("/var/lib/relay-monitoring");
if (disk.bavail * disk.bsize < 1024 * 1024 * 1024 + (existing ? 0 : bytes))
  throw new Error("Preserve at least 1 GiB of root space after the fixed swap reserve");
if (!existing) {
  await (await open(path, "wx", 0o600)).close();
  // Fully allocated extents on ext4; never create a sparse swap file.
  run(["fallocate", "--length", String(bytes), path]);
  run(["mkswap", path]);
  existing = await lstat(path);
}
if (!existing.isFile() || existing.uid !== 0 || existing.size !== bytes)
  throw new Error("Unexpected monitoring swap file; inspect it without reformatting");
if (run(["blkid", "--probe", "--match-tag", "TYPE", "--output", "value", path]) !== "swap")
  throw new Error("Existing monitoring file is not swap; never reformat it");
await chmod(path, 0o600);
const active = (await readFile("/proc/swaps", "utf8")).split("\n").some((line) => line.split(/\s+/)[0] === path);
if (!active) run(["swapon", path]);
if (!entries.length) {
  await appendFile("/etc/fstab", `${fstab.endsWith("\n") ? "" : "\n"}${entry}\n`);
  run(["systemctl", "daemon-reload"]);
}
console.log("Verified the fixed 256 MiB monitoring swap reserve");
