import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Native snapshots keep the Windows B5 observer within the same 500ms sampling policy.
// PROCESSENTRY32W uses the documented 64-bit layout:
// https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/ns-tlhelp32-processentry32w
const windowsProcessTable = async (states?: Map<number, string>) => {
  const { dlopen, ptr } = await import("bun:ffi");
  const kernel = dlopen("kernel32.dll", {
    CreateToolhelp32Snapshot: { args: ["u32", "u32"], returns: "u64" },
    Process32FirstW: { args: ["u64", "ptr"], returns: "bool" },
    Process32NextW: { args: ["u64", "ptr"], returns: "bool" },
    CloseHandle: { args: ["u64"], returns: "bool" },
    GetLastError: { args: [], returns: "u32" },
    OpenProcess: { args: ["u32", "bool", "u32"], returns: "u64" },
    WaitForSingleObject: { args: ["u64", "u32"], returns: "u32" },
  });
  const processState = (pid: number) => {
    // A terminated process can remain in Toolhelp until its last handle closes.
    // A signaled process handle proves exit; lookup/wait failures do not.
    const processHandle = kernel.symbols.OpenProcess(0x00100000, false, pid);
    if (BigInt(processHandle) === 0n) return `unreadable:${kernel.symbols.GetLastError()}`;
    try {
      const status = kernel.symbols.WaitForSingleObject(processHandle, 0);
      if (status === 0) return "exited";
      if (status === 258) return "active";
      return `wait-failed:${kernel.symbols.GetLastError()}`;
    } finally {
      kernel.symbols.CloseHandle(processHandle);
    }
  };
  const snapshot = kernel.symbols.CreateToolhelp32Snapshot(2, 0);
  try {
    if (BigInt(snapshot) === 0xffffffffffffffffn) throw new Error("Native process snapshot failed");
    const entry = new Uint8Array(568);
    const fields = new DataView(entry.buffer);
    fields.setUint32(0, entry.length, true);
    if (!kernel.symbols.Process32FirstW(snapshot, ptr(entry))) throw new Error("Native process snapshot is empty");
    const rows: number[][] = [];
    let more = true;
    while (more) {
      const pid = fields.getUint32(8, true);
      if (states?.has(pid)) states.set(pid, processState(pid));
      if (states?.get(pid) !== "exited") rows.push([pid, fields.getUint32(32, true)]);
      more = kernel.symbols.Process32NextW(snapshot, ptr(entry));
      if (!more && kernel.symbols.GetLastError() !== 18) throw new Error("Native process enumeration was interrupted");
    }
    return rows;
  } finally {
    if (BigInt(snapshot) !== 0xffffffffffffffffn) kernel.symbols.CloseHandle(snapshot);
    kernel.close();
  }
};

export const readProcessTable = async (states?: Map<number, string>) => {
  const rows =
    process.platform === "win32"
      ? await windowsProcessTable(states)
      : (await promisify(execFile)("ps", ["-axo", "pid=,ppid=,stat="])).stdout
          .trim()
          .split(/\r?\n/)
          .flatMap((line) => {
            const [pid, parent, state] = line.trim().split(/\s+/);
            if (!state) throw new Error("Missing native process state");
            states?.set(Number(pid), state);
            // Defunct children remain enumerable until reaped but have already exited.
            return state.startsWith("Z") ? [] : [[Number(pid), Number(parent)]];
          });
  if (!rows.length || rows.some((row) => row.length !== 2 || row.some((value) => !Number.isInteger(value))))
    throw new Error("Missing native process enumeration");
  return rows;
};

/** Enumerate real descendants; window/page counts do not describe Electron's process tree. */
export const ownedProcesses = async (roots: number[]) => {
  const rows = await readProcessTable();
  const live = new Set(rows.map(([pid]) => pid!));
  const owned = new Set(roots.filter((pid) => live.has(pid)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, parent] of rows)
      if (owned.has(parent!) && !owned.has(pid!)) {
        owned.add(pid!);
        changed = true;
      }
  }
  if (roots.some((pid) => !owned.has(pid))) throw new Error("An app-owned root is missing");
  return [...owned];
};
