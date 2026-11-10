import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { threadId } from "node:worker_threads";
import { resolvePstdioHome } from "pstdio-paths";

interface Stage {
  pid: number;
  threadId: number;
  paths: string[];
}
const stageRoot = () => join(resolvePstdioHome(), "cache", "extension-stages");
export const trackPreparationStage = (paths: string[], id: string = crypto.randomUUID()) => {
  const root = stageRoot();
  mkdirSync(root, { recursive: true });
  const record = join(root, `${id}.json`);
  const stage: Stage = { pid: process.pid, threadId, paths };
  const save = () => {
    writeFileSync(`${record}.tmp`, JSON.stringify(stage));
    renameSync(`${record}.tmp`, record);
  };
  save();
  return {
    add: (path: string) => {
      stage.paths.push(path);
      save();
    },
    release: () => rmSync(record, { force: true }),
    handoff: () => {
      stage.threadId = 0;
      save();
    },
  };
};
const stageOwnerAlive = (stage: Stage) => {
  if (stage.pid === process.pid) return stage.threadId === 0 || stage.threadId === threadId;
  try {
    process.kill(stage.pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
};
export const recoverPreparationStages = (disposing = false) => {
  const root = stageRoot();
  if (!existsSync(root)) return;
  for (const name of readdirSync(root).filter((name) => name.endsWith(".json"))) {
    const record = join(root, name);
    const stage: Stage = JSON.parse(readFileSync(record, "utf8"));
    const ownedHere = stage.pid === process.pid;
    if (!(disposing && ownedHere) && stageOwnerAlive(stage)) continue;
    try {
      for (const path of stage.paths) rmSync(path, { recursive: true, force: true });
      rmSync(record, { force: true });
    } catch {
      // Windows may still be closing a child handle; retain the record for the next owner.
    }
  }
};

export const disposePreparationStage = (id: string) => {
  if (!/^[a-f0-9-]+$/.test(id)) throw new Error("Invalid preparation stage ID");
  const record = join(stageRoot(), `${id}.json`);
  if (!existsSync(record)) return;
  const stage: Stage = JSON.parse(readFileSync(record, "utf8"));
  for (const path of stage.paths) rmSync(path, { recursive: true, force: true });
  rmSync(record, { force: true });
};
