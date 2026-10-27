import { mkdtempSync, readFileSync, renameSync, watch, writeFileSync } from "node:fs";
import { join } from "node:path";

// Replace a file by rename while another handle keeps reading and watching its folder.
const root = mkdtempSync(join(process.argv[2]!, "rename-probe-"));
const target = join(root, "heartbeat.json");
writeFileSync(target, "0");
const watcher = watch(root, () => {
  try {
    readFileSync(target, "utf8");
  } catch {}
});
const reader = setInterval(() => {
  try {
    readFileSync(target, "utf8");
  } catch {}
}, 1);
const errors = new Map<string, number>();
let ok = 0;
for (let i = 0; i < 300; i++) {
  try {
    writeFileSync(`${target}.tmp`, String(i));
    renameSync(`${target}.tmp`, target);
    ok++;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? String(error);
    errors.set(code, (errors.get(code) ?? 0) + 1);
  }
  await Bun.sleep(2);
}
clearInterval(reader);
watcher.close();
console.log(`PROBE ${process.argv[3]} ok=${ok} errors=${JSON.stringify(Object.fromEntries(errors))}`);
