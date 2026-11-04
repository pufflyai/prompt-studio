import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

const extensionInstallationSchema = z.object({
  id: z.string(),
  installName: z.string(),
  extensionId: z.string().optional(),
  displayName: z.string(),
  projectId: z.string(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  queuedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
});
export type ExtensionInstallation = z.infer<typeof extensionInstallationSchema>;

const storedJobs = z.array(extensionInstallationSchema);

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
  const save = (jobs: ExtensionInstallation[]) => {
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
