import { dlopen, ptr } from "bun:ffi";

const PROCESS_TERMINATE = 0x0001;
const PROCESS_SET_QUOTA = 0x0100;
const BASIC_ACCOUNTING_INFORMATION = 1;

const openKernel = () =>
  dlopen("kernel32.dll", {
    CreateJobObjectW: { args: ["ptr", "ptr"], returns: "u64" },
    OpenProcess: { args: ["u32", "bool", "u32"], returns: "u64" },
    AssignProcessToJobObject: { args: ["u64", "u64"], returns: "bool" },
    QueryInformationJobObject: { args: ["u64", "i32", "ptr", "u32", "ptr"], returns: "bool" },
    TerminateJobObject: { args: ["u64", "u32"], returns: "bool" },
    CloseHandle: { args: ["u64"], returns: "bool" },
    GetLastError: { args: [], returns: "u32" },
  });

let kernel: ReturnType<typeof openKernel> | undefined;

/** A job owns descendants independently of the PID of the original launcher. */
export const createWindowsProcessJob = () => {
  kernel ??= openKernel();
  const api = kernel.symbols;
  const failed = (operation: string) => new Error(`${operation} failed (Windows error ${api.GetLastError()}).`);
  // A non-inheritable, unnamed handle. No kill-on-close flag: an explicit detach may survive host exit.
  const job = api.CreateJobObjectW(null, null);
  if (!job) throw failed("Creating a process job");

  let closed = false;
  const counts = new Uint8Array(48);
  const view = new DataView(counts.buffer);

  return {
    attachLauncher(pid: number) {
      const launcher = api.OpenProcess(PROCESS_TERMINATE | PROCESS_SET_QUOTA, false, pid);
      if (!launcher) throw failed("Opening the process launcher");
      try {
        if (!api.AssignProcessToJobObject(job, launcher)) throw failed("Assigning the process launcher to its job");
      } finally {
        api.CloseHandle(launcher);
      }
    },
    hasProcesses() {
      if (closed) return false;
      if (!api.QueryInformationJobObject(job, BASIC_ACCOUNTING_INFORMATION, ptr(counts), counts.length, null))
        throw failed("Reading the process job");
      // JOBOBJECT_BASIC_ACCOUNTING_INFORMATION.ActiveProcesses follows four LARGE_INTEGERs and two DWORDs.
      return view.getUint32(40, true) !== 0;
    },
    terminate() {
      if (!closed && !api.TerminateJobObject(job, 1)) throw failed("Terminating the process job");
    },
    close() {
      if (closed) return;
      closed = true;
      api.CloseHandle(job);
    },
  };
};
