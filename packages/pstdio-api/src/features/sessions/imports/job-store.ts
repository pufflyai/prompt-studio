import { appendFile, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type SessionImportError, type SessionImportJob, sessionImportJobSchema } from "pstdio-api-contracts";
import { z } from "zod";
import { SessionImportError as ImportError, jsonLines } from "./source";

const stagingSchema = z.object({ sessionId: z.string(), projectId: z.string(), files: z.array(z.string().uuid()) });
export type SessionImportStaging = z.infer<typeof stagingSchema>;
const writeJson = async (target: string, value: unknown) => {
  const pending = `${target}.${crypto.randomUUID()}.partial`;
  const handle = await open(pending, "w");
  try {
    await handle.writeFile(JSON.stringify(value));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(pending, target);
};

export const createSessionImportJobStore = (directory: string) => {
  const file = (id: string, extension: string) => join(directory, `${z.string().uuid().parse(id)}.${extension}`);
  // Windows can refuse an atomic replacement while a status poll still holds the old file open.
  // Finish each checkpoint read or write before admitting the next; retain atomic publication.
  let pendingCheckpoint = Promise.resolve();
  const checkpoint = <T>(action: () => Promise<T>) => {
    const result = pendingCheckpoint.then(action);
    pendingCheckpoint = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  return {
    read: (id: string) =>
      checkpoint(async () => {
        try {
          return sessionImportJobSchema.parse(JSON.parse(await readFile(file(id, "json"), "utf8")));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new ImportError("Import not found.", 404);
          throw error;
        }
      }),
    write: (job: SessionImportJob) =>
      checkpoint(async () => {
        await mkdir(directory, { recursive: true });
        job.updatedAt = new Date().toISOString();
        const target = file(job.id, "json");
        await writeJson(target, job);
      }),
    writeStage: (id: string, staging: SessionImportStaging) => writeJson(file(id, "staging.json"), staging),
    clearStage: (id: string) => rm(file(id, "staging.json"), { force: true }),
    async readStage(id: string) {
      try {
        return stagingSchema.parse(JSON.parse(await readFile(file(id, "staging.json"), "utf8")));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
    },
    resetErrors: (id: string) => writeFile(file(id, "jsonl"), ""),
    appendError: (id: string, error: SessionImportError) => appendFile(file(id, "jsonl"), `${JSON.stringify(error)}\n`),
    async trimErrors(id: string, committed: number) {
      const target = file(id, "jsonl");
      const pending = `${target}.${crypto.randomUUID()}.partial`;
      const handle = await open(pending, "w");
      try {
        let copied = 0;
        if (committed)
          for await (const row of jsonLines(target)) {
            if (copied === committed) break;
            await handle.writeFile(`${JSON.stringify(row.value)}\n`);
            copied++;
          }
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(pending, target);
    },
    async errors(id: string, offset: number, limit: number, committed: number) {
      const errors: SessionImportError[] = [];
      if (offset >= committed) return { errors, nextOffset: null };
      for await (const row of jsonLines(file(id, "jsonl"), offset)) {
        if (errors.length === limit) return { errors, nextOffset: offset + limit };
        errors.push(row.value as SessionImportError);
        if (offset + errors.length === committed) return { errors, nextOffset: null };
      }
      return { errors, nextOffset: null };
    },
  };
};
