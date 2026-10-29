import { writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { join } from "node:path";

let profiling: Session | null = null;
const entries: { phase: string; at: number; wall: number }[] = [];
export const startupProbe = (phase: string) => {
  entries.push({ phase, at: performance.now(), wall: Date.now() });
  if (phase === "capture-create-start" && profiling === null) {
    profiling = new Session();
    profiling.connect();
    profiling.post("Profiler.enable");
    profiling.post("Profiler.start");
  }
  if (phase === "checksum-end" && profiling !== null) {
    const session = profiling;
    profiling = null;
    session.post("Profiler.stop", (error, result) => {
      if (!error)
        writeFileSync(join(process.env.PSTDIO_HOME!, "startup-profile.cpuprofile"), JSON.stringify(result.profile));
      session.disconnect();
    });
  }
};
export const flushStartupProbe = () => {
  writeFileSync(join(process.env.PSTDIO_HOME!, "startup-probe.json"), JSON.stringify(entries, null, 2));
};
