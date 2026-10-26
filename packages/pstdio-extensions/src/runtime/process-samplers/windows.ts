import { dlopen, ptr } from "bun:ffi";
import type { ProcessIdentity, ProcessReading } from "../process-sampler";

export const createWindowsProcessSampler = () => {
  // HANDLE is an integer token, not a pointer (https://bun.sh/docs/runtime/ffi#pointers).
  const kernel = dlopen("kernel32.dll", {
    OpenProcess: { args: ["u32", "bool", "u32"], returns: "u64" },
    CloseHandle: { args: ["u64"], returns: "bool" },
    GetProcessTimes: { args: ["u64", "ptr", "ptr", "ptr", "ptr"], returns: "bool" },
    K32GetProcessMemoryInfo: { args: ["u64", "ptr", "u32"], returns: "bool" },
    CreateToolhelp32Snapshot: { args: ["u32", "u32"], returns: "u64" },
    Process32FirstW: { args: ["u64", "ptr"], returns: "bool" },
    Process32NextW: { args: ["u64", "ptr"], returns: "bool" },
  });
  return {
    list: async () => {
      const snapshot = kernel.symbols.CreateToolhelp32Snapshot(2, 0); // TH32CS_SNAPPROCESS
      if (!snapshot || snapshot === 0xffffffffffffffffn) throw new Error("Process table is unavailable.");
      try {
        // PROCESSENTRY32W, 64-bit alignment: learn.microsoft.com/windows/win32/api/tlhelp32/ns-tlhelp32-processentry32w
        const buffer = new Uint8Array(568);
        const fields = new DataView(buffer.buffer);
        fields.setUint32(0, buffer.length, true);
        const identities: ProcessIdentity[] = [];
        let found = kernel.symbols.Process32FirstW(snapshot, ptr(buffer));
        if (!found) throw new Error("Cannot enumerate the process table.");
        while (found) {
          identities.push({ pid: fields.getUint32(8, true), parentPid: fields.getUint32(32, true) });
          if (identities.length > 16_384) throw new Error("Process table exceeds the observation bound.");
          found = kernel.symbols.Process32NextW(snapshot, ptr(buffer));
        }
        return identities;
      } finally {
        kernel.symbols.CloseHandle(snapshot);
      }
    },
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
