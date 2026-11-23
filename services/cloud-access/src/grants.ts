import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { AccessError, roles, runInputSchema } from "./config";

const grantSchema = runInputSchema.extend({
  principalId: z.uuid(),
  launcher: z.string(),
  revoked: z.boolean().default(false),
  roles: z.array(z.enum(roles)),
  templates: z.array(z.string()),
});
export type Grant = z.infer<typeof grantSchema>;

// One state directory belongs to one broker process. Atomic rename preserves grants on restart.
export async function createGrantStore(root: string) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const path = (id: string) => join(root, `${z.uuid().parse(id)}.json`);
  const get = async (id: string) => {
    try {
      return grantSchema.parse(JSON.parse(await readFile(path(id), "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  };
  const save = async (grant: Grant) => {
    const target = path(grant.runId);
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(grant), { mode: 0o600 });
    await rename(temporary, target);
  };
  let pending: Promise<unknown> = Promise.resolve();
  return {
    get,
    save,
    // Serialize issuance and revocation together so no key can be issued after revocation.
    exclusive<T>(work: () => Promise<T>) {
      const next = pending.then(work, work);
      pending = next.catch(() => undefined);
      return next;
    },
    async assertNew(id: string) {
      if (await get(id)) throw new AccessError(409, "Run already registered.");
    },
    async assertSubjectBinding(subject: string, bound: boolean) {
      for (const name of await readdir(root)) {
        if (!/^[0-9a-f-]{36}\.json$/i.test(name)) continue;
        const existing = await get(name.slice(0, -5));
        if (existing?.subject === subject && (!bound || !existing.instance))
          throw new AccessError(409, "A subject shared by runs requires a signed instance binding.");
      }
    },
    async cleanup(now = Date.now()) {
      for (const name of await readdir(root)) {
        if (!/^[0-9a-f-]{36}\.json$/i.test(name)) continue;
        const grant = await get(name.slice(0, -5));
        // Expired credentials need no renewal; retain tombstones for seven days for diagnosis.
        if (grant && Date.parse(grant.deadline) + 7 * 86400_000 < now) await unlink(path(grant.runId));
      }
    },
  };
}
export type GrantStore = Awaited<ReturnType<typeof createGrantStore>>;
