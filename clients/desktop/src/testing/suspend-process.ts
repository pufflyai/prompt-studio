import { execFileSync } from "node:child_process";

export const suspendProcess = (pid: number) => {
  if (process.platform === "win32") {
    execFileSync("pssuspend64.exe", ["-accepteula", String(pid)]);
  } else {
    process.kill(pid, "SIGSTOP");
  }
};

export const resumeProcess = (pid: number) => {
  if (process.platform === "win32") {
    execFileSync("pssuspend64.exe", ["-accepteula", "-r", String(pid)]);
  } else {
    process.kill(pid, "SIGCONT");
  }
};
