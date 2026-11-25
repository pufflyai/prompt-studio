import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { apiLogger } from "../../../lib/logger";

const grantSchema = z.object({
  projectId: z.string(),
  extensionId: z.string(),
  sourceIdentity: z.string(),
  names: z.array(z.string()),
  grantedAt: z.string(),
});
const fileSchema = z.object({ version: z.literal(1), grants: z.array(grantSchema) });

export type ProcessEnvironmentGrant = z.infer<typeof grantSchema>;

export const grantKey = (projectId: string, extensionId: string) => JSON.stringify([projectId, extensionId]);

export const readGrantFile = async (path: string) => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map<string, ProcessEnvironmentGrant>();
    throw error;
  }
  let parsed: z.infer<typeof fileSchema> | undefined;
  try {
    parsed = fileSchema.parse(JSON.parse(text));
  } catch (error) {
    // Unreadable grants fail closed: nothing is granted until a person allows names again.
    apiLogger.warn(
      { err: error, event: "extension.process_environment.grants_unreadable", path },
      "Extension environment grants could not be read; nothing is granted until they are allowed again",
    );
  }
  return new Map(parsed?.grants.map((grant) => [grantKey(grant.projectId, grant.extensionId), grant]));
};

// A crash mid-write must leave either the previous grants or the new ones, never a torn file.
export const writeGrantFile = async (path: string, grants: Iterable<ProcessEnvironmentGrant>) => {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify({ version: 1, grants: [...grants] }, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
};
