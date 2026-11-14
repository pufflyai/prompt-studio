import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Native snapshots keep the Windows B5 observer within the same 500ms sampling policy.
// PROCESSENTRY32W uses the documented 64-bit layout:
// https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/ns-tlhelp32-processentry32w
const windowsProcessTable = async () => {
  const { dlopen, ptr } = await import("bun:ffi");
  const kernel = dlopen("kernel32.dll", {
    CreateToolhelp32Snapshot: { args: ["u32", "u32"], returns: "u64" },
    Process32FirstW: { args: ["u64", "ptr"], returns: "bool" },
    Process32NextW: { args: ["u64", "ptr"], returns: "bool" },
    CloseHandle: { args: ["u64"], returns: "bool" },
    GetLastError: { args: [], returns: "u32" },
  });
  const snapshot = kernel.symbols.CreateToolhelp32Snapshot(2, 0);
  try {
    if (BigInt(snapshot) === 0xffffffffffffffffn) throw new Error("Native process snapshot failed");
    const entry = new Uint8Array(568);
    const fields = new DataView(entry.buffer);
    fields.setUint32(0, entry.length, true);
    if (!kernel.symbols.Process32FirstW(snapshot, ptr(entry))) throw new Error("Native process snapshot is empty");
    const rows: number[][] = [];
    do {
      rows.push([fields.getUint32(8, true), fields.getUint32(32, true)]);
    } while (kernel.symbols.Process32NextW(snapshot, ptr(entry)));
    if (kernel.symbols.GetLastError() !== 18) throw new Error("Native process enumeration was interrupted");
    return rows;
  } finally {
    if (BigInt(snapshot) !== 0xffffffffffffffffn) kernel.symbols.CloseHandle(snapshot);
    kernel.close();
  }
};

export const readProcessTable = async () => {
  const rows =
    process.platform === "win32"
      ? await windowsProcessTable()
      : (await promisify(execFile)("ps", ["-axo", "pid=,ppid="])).stdout
          .trim()
          .split(/\r?\n/)
          .map((line) => line.trim().split(/\s+/).map(Number));
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
