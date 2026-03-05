import type { exec as defaultExec } from "node:child_process";
import { PassThrough } from "node:stream";

type RunStartupScriptDeps = {
  exec: typeof defaultExec;
  log: (msg: string) => void;
  setStartupLog: (baseUrl: string, workspaceId: string, content: string) => Promise<unknown>;
};

type RunStartupScriptInput = {
  script: string;
  cwd: string;
  apiUrl: string;
  workspaceId: string;
  workspaceShorthand: string;
};

export const runStartupScript = async (deps: RunStartupScriptDeps, input: RunStartupScriptInput) => {
  deps.log("Running startup script...");
  const logChunks: Buffer[] = [];
  let scriptFailed = false;
  let exitCode = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      const child = deps.exec(input.script, { cwd: input.cwd }, (error) => {
        if (error) reject(error);
        else resolve();
      });

      if (child.stdout) {
        const tee = new PassThrough();
        child.stdout.pipe(tee);
        child.stdout.pipe(process.stdout);
        tee.on("data", (chunk: Buffer) => logChunks.push(chunk));
      }

      if (child.stderr) {
        const tee = new PassThrough();
        child.stderr.pipe(tee);
        child.stderr.pipe(process.stderr);
        tee.on("data", (chunk: Buffer) => logChunks.push(chunk));
      }
    });
    deps.log("Startup script completed.");
  } catch (err) {
    exitCode = (err as { code?: number }).code ?? 1;
    scriptFailed = true;
    deps.log(`Warning: startup script exited with code ${exitCode}.`);
  }

  const logContent = Buffer.concat(logChunks).toString("utf8");
  if (logContent.length > 0) {
    try {
      await deps.setStartupLog(input.apiUrl, input.workspaceId, logContent);
      if (scriptFailed) {
        deps.log(`Startup log saved. View with: pstdio workspaces startup-log --id ${input.workspaceShorthand}`);
      }
    } catch {
      deps.log("Warning: failed to save startup log.");
    }
  }
};
