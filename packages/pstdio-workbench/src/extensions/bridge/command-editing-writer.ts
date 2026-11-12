import type {
  JsonObject,
  WebviewEditingChange,
  WebviewEditingCommandResult,
} from "pstdio-api-contracts/extension-kernel";
import type { CommandEditingMember, EditingExecutor } from "./command-editing-types";

export interface CommandEditingJob {
  params: JsonObject;
  changes: WebviewEditingChange[];
  revision: number;
  channel?: "document" | "presentation";
  execute: EditingExecutor;
  workbench: CommandEditingMember["workbench"];
  settlement?: ReturnType<typeof Promise.withResolvers<void>>;
}

/** Each caller waits for captured accepted work; a peer's future commands cannot prolong its barrier. */
export const createCommandEditingWriter = (input: {
  run(job: CommandEditingJob, accepted: (result: WebviewEditingCommandResult) => void): Promise<void>;
  accepted(job: CommandEditingJob, result: WebviewEditingCommandResult): void;
  failed(cause: unknown, job: CommandEditingJob): void;
  changed(): void;
}) => {
  const jobs: CommandEditingJob[] = [];
  let running = false;
  const pump = () => {
    if (running || !jobs.length) return;
    running = true;
    void Promise.resolve().then(async () => {
      try {
        while (jobs.length) {
          const job = jobs[0];
          await input.run(job, (result) => {
            jobs.shift();
            try {
              input.accepted(job, result);
            } catch (error) {
              job.settlement?.reject(error);
              throw error;
            }
            job.settlement?.resolve();
          });
        }
      } catch (cause) {
        if (jobs[0]) input.failed(cause, jobs[0]);
        for (const job of jobs) {
          job.settlement?.reject(cause);
          job.settlement = undefined;
        }
      } finally {
        running = false;
        input.changed();
      }
    });
  };
  const wait = (selected: CommandEditingJob[]) => {
    if (!selected.length) return Promise.resolve();
    const pending = selected.map((job) => {
      job.settlement ??= Promise.withResolvers<void>();
      return job.settlement.promise;
    });
    pump();
    return Promise.all(pending).then(() => undefined);
  };
  return {
    jobs,
    active: () => running || jobs.length > 0,
    wait,
    flush(workbench?: CommandEditingMember["workbench"]) {
      return wait(jobs.filter((job) => !workbench || job.workbench === workbench));
    },
  };
};
