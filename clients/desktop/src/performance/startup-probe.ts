import { writeFileSync } from "node:fs";
import { join } from "node:path";

const entries: { phase: string; at: number; wall: number }[] = [];
export const startupProbe = (phase: string) => {
  entries.push({ phase, at: performance.now(), wall: Date.now() });
};
export const flushStartupProbe = () => {
  writeFileSync(join(process.env.PSTDIO_HOME!, "startup-probe.json"), JSON.stringify(entries, null, 2));
};
