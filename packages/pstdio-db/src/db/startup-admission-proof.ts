import { createHash } from "node:crypto";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extensionIdentityRenames } from "pstdio-api-contracts/extension-host";

// The exclusive DB lock covers reading, consuming and replacing this single
// optional checkpoint. Only a clean close may vouch for the next ordinary open.
const version = JSON.stringify([1, extensionIdentityRenames]);
const control = async (home: string) =>
  createHash("sha256")
    .update(await readFile(join(home, "global", "pg_control")))
    .digest("hex");
const stamp = async (file: string) => {
  try {
    const s = await stat(file, { bigint: true });
    return [s.dev, s.ino, s.ctimeNs, s.mtimeNs, s.size].join(":");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return null;
  }
};

export const openAdmissionProof = async (home: string, indexNodes: string) => {
  const target = join(home, ".pstdio-startup-admission");
  const archive = join(`${home}-migration-exports`, "artifact_file_projection_roots.jsonl");
  const evidence = async () =>
    JSON.stringify([version, indexNodes, await stamp(archive), await stamp(`${archive}.admission.json`)]);
  let verified: string | undefined;
  try {
    const saved = await readFile(target, "utf8");
    const original = await evidence();
    if (saved === JSON.stringify([await control(home), original])) verified = original;
  } catch {
    // Missing, unreadable or partial proof takes the full admission path.
  }
  // An unclean stop, including an interruption while upgrading, must recheck.
  await rm(target, { force: true });
  return {
    matched: verified !== undefined,
    evidence: () => verified ?? evidence(),
    async save(originalEvidence: string) {
      const temporary = `${target}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify([await control(home), originalEvidence]), { mode: 0o600 });
        await rename(temporary, target);
      } catch {
        // This is an optimization. A failed write cannot invalidate a clean DB close.
        await rm(temporary, { force: true }).catch(() => {});
      }
    },
  };
};
