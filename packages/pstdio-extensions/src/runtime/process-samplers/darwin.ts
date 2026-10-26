import { dlopen, ptr } from "bun:ffi";
import type { ProcessIdentity, ProcessReading } from "../process-sampler";

export const createDarwinProcessSampler = () => {
  const library = dlopen("/usr/lib/libproc.dylib", {
    proc_pid_rusage: { args: ["int", "int", "ptr"], returns: "int" },
    proc_listallpids: { args: ["ptr", "int"], returns: "int" },
    proc_pidinfo: { args: ["int", "int", "u64", "ptr", "int"], returns: "int" },
    mach_timebase_info: { args: ["ptr"], returns: "int" },
  });
  const timebase = new Uint32Array(2);
  if (library.symbols.mach_timebase_info(ptr(timebase)) !== 0 || !timebase[1]) {
    library.close();
    throw new Error("Cannot read the kernel CPU timebase.");
  }
  const millisecondsPerTick = timebase[0]! / timebase[1]! / 1_000_000;
  return {
    list: async () => {
      const count = library.symbols.proc_listallpids(null, 0) + 32;
      if (count <= 0 || count > 16_384)
        throw new Error("Process table is unavailable or exceeds the observation bound.");
      const pids = new Int32Array(count);
      const length = library.symbols.proc_listallpids(ptr(pids), pids.byteLength);
      if (length < 0 || length >= count) throw new Error("Process table changed beyond the observation bound.");
      // proc_bsdinfo in Apple's bsd/sys/proc_info.h (PROC_PIDTBSDINFO).
      const buffer = new Uint8Array(136);
      const fields = new DataView(buffer.buffer);
      const identities: ProcessIdentity[] = [];
      for (const pid of pids.subarray(0, length)) {
        if (pid <= 0 || library.symbols.proc_pidinfo(pid, 3, 0, ptr(buffer), buffer.length) !== buffer.length) continue;
        if (fields.getUint32(4, true) === 5) continue; // SZOMB
        identities.push({ pid, parentPid: fields.getUint32(16, true), groupId: fields.getUint32(100, true) });
      }
      return identities;
    },
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
