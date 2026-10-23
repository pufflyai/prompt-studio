import { dlopen } from "bun:ffi";
import { readFile } from "node:fs/promises";
import type { ProcessReading } from "../process-sampler";

export const createLinuxProcessSampler = () => {
  const library = dlopen("libc.so.6", { sysconf: { args: ["int"], returns: "i64" } });
  const clockTicks = Number(library.symbols.sysconf(2)); // Linux _SC_CLK_TCK
  if (clockTicks <= 0) {
    library.close();
    throw new Error("Cannot read the kernel CPU clock rate");
  }
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
        return {
          processStartId: fields[19]!,
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
