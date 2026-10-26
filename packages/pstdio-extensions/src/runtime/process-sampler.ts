/** Shared kernel readings remain available while the observed process's event loop is blocked. */
export interface ProcessReading {
  processStartId: string;
  cpuTimeMs: number;
  residentBytes: number;
  peakResidentBytes: number | null;
  physicalFootprintBytes: number | null;
  peakPhysicalFootprintBytes: number | null;
  privateCommittedBytes: number | null;
}

export interface ProcessIdentity {
  pid: number;
  parentPid: number;
  groupId?: number;
}

export const createProcessSampler = async () => {
  switch (process.platform) {
    case "darwin":
      return (await import("./process-samplers/darwin")).createDarwinProcessSampler();
    case "linux":
      return (await import("./process-samplers/linux")).createLinuxProcessSampler();
    case "win32":
      return (await import("./process-samplers/windows")).createWindowsProcessSampler();
    default:
      throw new Error(`Process diagnostics are unavailable on ${process.platform}`);
  }
};
