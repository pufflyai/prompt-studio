import { dlopen, ptr } from "bun:ffi";
import type { ProcessReading } from "../process-sampler";

export const createWindowsProcessSampler = () => {
  // HANDLE is an integer token, not a pointer (https://bun.sh/docs/runtime/ffi#pointers).
  const kernel = dlopen("kernel32.dll", {
    OpenProcess: { args: ["u32", "bool", "u32"], returns: "u64" },
    CloseHandle: { args: ["u64"], returns: "bool" },
    GetProcessTimes: { args: ["u64", "ptr", "ptr", "ptr", "ptr"], returns: "bool" },
    K32GetProcessMemoryInfo: { args: ["u64", "ptr", "u32"], returns: "bool" },
  });
  return {
    read: async (pid: number) => {
      const handle = kernel.symbols.OpenProcess(0x1000, false, pid); // PROCESS_QUERY_LIMITED_INFORMATION
      if (!handle) return null;
      try {
        const times = new Uint8Array(32);
        if (!kernel.symbols.GetProcessTimes(handle, ptr(times), ptr(times, 8), ptr(times, 16), ptr(times, 24)))
          return null;
        const time = new DataView(times.buffer);
        if (time.getBigUint64(8, true) !== 0n) return null;
        // PROCESS_MEMORY_COUNTERS_EX on the supported 64-bit Windows runtime.
        const memory = new Uint8Array(80);
        const fields = new DataView(memory.buffer);
        fields.setUint32(0, memory.length, true);
        if (!kernel.symbols.K32GetProcessMemoryInfo(handle, ptr(memory), memory.length)) return null;
        return {
          processStartId: time.getBigUint64(0, true).toString(),
          cpuTimeMs: Number(time.getBigUint64(16, true) + time.getBigUint64(24, true)) / 10_000,
          residentBytes: Number(fields.getBigUint64(16, true)),
          peakResidentBytes: Number(fields.getBigUint64(8, true)),
          physicalFootprintBytes: null,
          peakPhysicalFootprintBytes: null,
          privateCommittedBytes: Number(fields.getBigUint64(72, true)),
        } satisfies ProcessReading;
      } finally {
        kernel.symbols.CloseHandle(handle);
      }
    },
    close: () => kernel.close(),
  };
};
