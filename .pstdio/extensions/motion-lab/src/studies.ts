import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { buildScene } from "./scene-builder";
import { studyId, studySchema } from "./study-schema";
export const studiesPath = "design/motion/studies";
const cache = new Map<string, { hash: string; module: Awaited<ReturnType<typeof buildScene>> }>();
export const readStudy = async (files: ArtifactMount, id: string) => {
  if (!studyId.safeParse(id).success)
    return {
      ok: false as const,
      reason: "invalid" as const,
      issues: [{ path: "id", message: "Use a kebab-case study id" }],
    };
  const prefix = `${studiesPath}/${id}/`;
  if (!(await files.exists(`${prefix}study.json`))) return { ok: false as const, reason: "missing" as const };
  let metadata: unknown;
  try {
    metadata = JSON.parse(await files.readText(`${prefix}study.json`));
  } catch (error) {
    return { ok: false as const, reason: "invalid" as const, issues: [{ path: "study.json", message: String(error) }] };
  }
  const parsed = studySchema.safeParse(metadata);
  if (!parsed.success)
    return {
      ok: false as const,
      reason: "invalid" as const,
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    };
  const sources: Record<string, string> = {};
  const hash = new Bun.CryptoHasher("sha256");
  for (const { path } of (await files.list(`${prefix}**/*`)).sort((a, b) => a.path.localeCompare(b.path))) {
    const content = await files.readBytes(path);
    hash.update(JSON.stringify([path, content.byteLength]));
    hash.update(content);
    sources[path.slice(prefix.length)] = new TextDecoder().decode(content);
  }
  return { ok: true as const, study: { id, ...parsed.data }, hash: hash.digest("hex"), sources };
};
export const listStudies = async (files: ArtifactMount) => {
  const entries = (await files.list(`${studiesPath}/*/study.json`)).filter(({ path }) =>
    /^design\/motion\/studies\/[^/]+\/study\.json$/.test(path),
  );
  const studies = await Promise.all(
    entries.map(async ({ path }) => {
      const id = path.split("/")[3];
      const result = await readStudy(files, id);
      if (!result.ok)
        return { id, ok: false, title: id, group: "Invalid", description: "Invalid study metadata", hash: "" };
      return { ...result.study, ok: true, hash: result.hash };
    }),
  );
  return studies.sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title));
};
export const readBuiltStudy = async (files: ArtifactMount, id: string) => {
  const result = await readStudy(files, id);
  if (!result.ok) return result;
  const cached = cache.get(id);
  const module = cached?.hash === result.hash ? cached.module : await buildScene(result.sources);
  cache.set(id, { hash: result.hash, module });
  return { ok: true as const, study: result.study, hash: result.hash, module };
};
