import { dlopen, ptr } from "bun:ffi";
import { basename } from "node:path";

// This module is loaded only on Darwin; the system library stays owned by the host process.
const { symbols } = dlopen("/usr/lib/libSystem.B.dylib", {
  proc_pidinfo: { args: ["int", "int", "u64", "ptr", "int"], returns: "int" },
  sysctl: { args: ["ptr", "u32", "ptr", "ptr", "ptr", "u64"], returns: "int" },
});
const argumentLimit = new Int32Array(1);
const argumentLimitSize = new BigUint64Array([BigInt(argumentLimit.byteLength)]);
const argumentLimitMib = new Int32Array([1, 8]);
if (symbols.sysctl(ptr(argumentLimitMib), 2, ptr(argumentLimit), ptr(argumentLimitSize), null, 0) !== 0)
  throw new Error("Cannot read macOS process argument limit");

const processInfo = (pid: number) => {
  // sys/proc_info.h: PROC_PIDTBSDINFO, a 136-byte proc_bsdinfo on supported 64-bit Macs.
  const bytes = new Uint8Array(136);
  if (symbols.proc_pidinfo(pid, 3, 0, ptr(bytes), bytes.length) !== bytes.length) return null;
  return new DataView(bytes.buffer);
};

export const readDarwinTerminalForeground = (pid: number) => {
  const before = processInfo(pid);
  if (!before) return null;
  const group = before.getInt32(112, true); // proc_bsdinfo.e_tpgid
  if (group <= 0) return null;

  // KERN_PROCARGS2 retains argv[0], including exec aliases, as ps -o comm does.
  const args = new Uint8Array(argumentLimit[0]!);
  const size = new BigUint64Array([BigInt(args.length)]);
  const mib = new Int32Array([1, 49, group]);
  if (symbols.sysctl(ptr(mib), mib.length, ptr(args), ptr(size), null, 0) !== 0) return null;
  const length = Number(size[0]);
  if (length < 4 || new DataView(args.buffer).getInt32(0, true) <= 0) return null;
  const pathEnd = args.indexOf(0, 4);
  if (pathEnd < 4 || pathEnd >= length) return null;
  let start = pathEnd + 1;
  while (start < length && args[start] === 0) start++;
  const end = args.indexOf(0, start);
  if (end <= start || end >= length) return null;

  const after = processInfo(pid);
  // A restarted shell or foreground switch cannot inherit the previous title.
  if (
    !after ||
    after.getInt32(112, true) !== group ||
    after.getBigUint64(120, true) !== before.getBigUint64(120, true) ||
    after.getBigUint64(128, true) !== before.getBigUint64(128, true)
  )
    return null;
  return { group, name: basename(new TextDecoder().decode(args.subarray(start, end)).trim()) };
};
