import { dlopen, ptr } from "bun:ffi";
import { readFile } from "node:fs/promises";
import type { ProcessReading } from "../process-sampler";

export const createLinuxProcessSampler = () => {
  const library = dlopen("libc.so.6", {
    sysconf: { args: ["int"], returns: "i64" },
    clock_gettime: { args: ["int", "ptr"], returns: "int" },
  });
  const clockTicks = Number(library.symbols.sysconf(2)); // Linux _SC_CLK_TCK
  if (clockTicks <= 0) {
    library.close();
    throw new Error("Cannot read the kernel CPU clock rate");
  }
  const clockNs = (clock: number) => {
    const time = new BigInt64Array(2);
    if (library.symbols.clock_gettime(clock, ptr(time)) !== 0) throw new Error("Cannot read the kernel clock");
    return time[0]! * 1_000_000_000n + time[1]!;
  };
  return {
    read: async (pid: number) => {
      try {
        const [stat, status] = await Promise.all([
          readFile(`/proc/${pid}/stat`, "utf8"),
          readFile(`/proc/${pid}/status`, "utf8"),
        ]);
        // comm is parenthesized and may itself contain spaces or parentheses.
        const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
        if (fields[0] === "Z") return null;
        const memory = (key: string) => {
          const match = status.match(new RegExp(`^${key}:\\s+(\\d+) kB$`, "m"));
          return match ? Number(match[1]) * 1024 : null;
        };
        const residentBytes = memory("VmRSS");
        if (residentBytes === null) return null;
        // /proc/stat btime discards the fractional boot second. Both clocks include suspend.
        const bootEpochNs = clockNs(0) - clockNs(7); // CLOCK_REALTIME - CLOCK_BOOTTIME
        const startedAtMs = Number(
          (bootEpochNs + (BigInt(fields[19]!) * 1_000_000_000n) / BigInt(clockTicks)) / 1_000_000n,
        );
        return {
          processStartId: fields[19]!,
          startedAt: new Date(startedAtMs).toISOString(),
          cpuTimeMs: ((Number(fields[11]) + Number(fields[12])) * 1000) / clockTicks,
          residentBytes,
          peakResidentBytes: memory("VmHWM"),
          physicalFootprintBytes: null,
          peakPhysicalFootprintBytes: null,
          privateCommittedBytes: null,
        } satisfies ProcessReading;
      } catch (error) {
        if (["ENOENT", "ESRCH", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) return null;
        throw error;
      }
    },
    close: () => library.close(),
  };
};
