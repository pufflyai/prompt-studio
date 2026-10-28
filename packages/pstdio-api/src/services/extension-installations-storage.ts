import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { extensionInstallationSchema } from "pstdio-api-contracts";
import { z } from "zod";

const storedJobs = z.array(
  z.object({
    job: extensionInstallationSchema,
    request: z.object({ kind: z.literal("catalog"), name: z.string() }),
  }),
);
export const createInstallationStorage = (path?: string) => {
  let writes = Promise.resolve();
  const read = () => {
    if (!path) return [];
    try {
      return storedJobs.parse(JSON.parse(readFileSync(path, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  };
  const save = (jobs: z.infer<typeof storedJobs>) => {
    if (!path) return Promise.resolve();
    const body = JSON.stringify(jobs);
    writes = writes
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.${crypto.randomUUID()}.tmp`;
        await writeFile(temporary, body);
        await rename(temporary, path);
      });
    return writes;
  };
  return { read, save, flush: () => writes };
};
