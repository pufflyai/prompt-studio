import { dlopen, ptr } from "bun:ffi";
import type { ProcessReading } from "../process-sampler";

export const createDarwinProcessSampler = () => {
  const library = dlopen("/usr/lib/libproc.dylib", {
    proc_pid_rusage: { args: ["int", "int", "ptr"], returns: "int" },
    mach_timebase_info: { args: ["ptr"], returns: "int" },
  });
  const timebase = new Uint32Array(2);
  library.symbols.mach_timebase_info(ptr(timebase));
  // Native CPU counters use Mach ticks, whose duration depends on the machine.
  const millisecondsPerTick = timebase[0]! / timebase[1]! / 1_000_000;
  return {
    read: async (pid: number) => {
      // sys/resource.h rusage_info_v4: UUID followed by thirty-five uint64 fields.
      const buffer = new BigUint64Array(37);
      if (library.symbols.proc_pid_rusage(pid, 4, ptr(buffer)) !== 0) return null;
      const fields = new DataView(buffer.buffer);
      const number = (offset: number) => Number(fields.getBigUint64(offset, true));
      return {
        processStartId: fields.getBigUint64(80, true).toString(),
        cpuTimeMs: (number(16) + number(24)) * millisecondsPerTick,
        residentBytes: number(64),
        peakResidentBytes: null,
        physicalFootprintBytes: number(72),
        peakPhysicalFootprintBytes: number(240),
        privateCommittedBytes: null,
      } satisfies ProcessReading;
    },
    close: () => library.close(),
  };
};
