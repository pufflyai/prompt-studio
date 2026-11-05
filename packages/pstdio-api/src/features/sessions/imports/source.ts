import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { type SessionImportSource, sessionMessageSchema, sessionUsageSchema } from "pstdio-api-contracts";
import { z } from "zod";
import { createImportFileIndex } from "./file-index";

export class SessionImportError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}
export const importedSessionId = (sourceId: string, projectId: string) =>
  `imported-${createHash("sha256")
    .update(JSON.stringify([projectId, sourceId]))
    .digest("hex")}`;

export async function* jsonLines(path: string, after = 0) {
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let line = 0;
  try {
    for await (const text of lines) {
      line++;
      if (line <= after || !text.trim()) continue;
      try {
        yield { line, value: JSON.parse(text) as unknown };
      } catch {
        yield { line, error: "Invalid JSON in exported row." };
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid timestamp");
export const exportedSessionSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().min(1),
  title: z.string(),
  agent: z.string().nullable().default(null),
  status: z.string().default("completed"),
  archived: z.boolean().default(false),
  session_file_id: z.string().min(1),
  last_selected_model: z.string().nullable().default(null),
  params_json: z
    .record(z.string(), z.union([z.string(), z.boolean()]))
    .nullable()
    .default(null),
  usage_json: sessionUsageSchema.nullable().default(null),
  original_session_id: z.string().nullable().optional(),
  last_request_started: timestamp.nullable().default(null),
  last_request_ended: timestamp.nullable().default(null),
  created_at: timestamp,
  updated_at: timestamp,
});
export type ExportedSession = z.infer<typeof exportedSessionSchema>;
const fileSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  storage_path: z.string(),
  file_name: z.string(),
  mime_type: z.string().nullable().default(null),
});
export type ExportedFile = z.infer<typeof fileSchema>;
const exists = async (path: string) => {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};
const inside = (root: string, path: string) => {
  const part = relative(root, path);
  return part !== ".." && !part.startsWith(`..${sep}`) && !isAbsolute(part);
};
const digest = async (paths: string[], signal?: AbortSignal) => {
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update("\0");
    for await (const chunk of createReadStream(path)) {
      signal?.throwIfAborted();
      hash.update(chunk);
    }
  }
  return hash.digest("hex");
};

export const locateSessionImportSource = async (input: SessionImportSource) => {
  const sourcePath = await realpath(resolve(input.sourcePath)).catch(() => {
    throw new SessionImportError("Backup folder not found.");
  });
  if (!(await stat(sourcePath)).isDirectory()) throw new SessionImportError("Backup source must be a folder.");
  const candidates = [join(sourcePath, "tables"), join(sourcePath, "export", "tables"), sourcePath];
  const tables = (
    await Promise.all(
      candidates.map(async (path) => ((await exists(join(path, "public.sessions.jsonl"))) ? path : undefined)),
    )
  ).find(Boolean);
  if (!tables) throw new SessionImportError("Expected an exported backup containing tables/public.sessions.jsonl.");
  const sessionsPath = join(tables, "public.sessions.jsonl");
  const filesPath = join(tables, "public.files.jsonl");
  if (!(await exists(filesPath))) throw new SessionImportError("Backup is missing tables/public.files.jsonl.");
  const roots = [sourcePath];
  const localStorage = await realpath(join(sourcePath, "storage")).catch(() => undefined);
  if (input.storagePath)
    roots.push(
      await realpath(resolve(input.storagePath)).catch(() => {
        throw new SessionImportError("Storage folder not found.");
      }),
    );
  if (localStorage && inside(sourcePath, localStorage)) roots.push(localStorage);
  return { sourcePath, sessionsPath, filesPath, tables, roots };
};

export const openSessionImportSource = async (
  input: SessionImportSource,
  options: { signal?: AbortSignal; onProgress?(count: number): Promise<void> } = {},
) => {
  const { sourcePath, sessionsPath, filesPath, tables, roots } = await locateSessionImportSource(input);
  const files = await createImportFileIndex();
  try {
    let indexed = 0;
    let batch: ExportedFile[] = [];
    for await (const row of jsonLines(filesPath)) {
      options.signal?.throwIfAborted();
      const parsed = fileSchema.safeParse(row.value);
      if (row.error || !parsed.success) throw new SessionImportError(`Invalid files table row ${row.line}.`);
      batch.push(parsed.data);
      indexed++;
      if (batch.length === 1000) {
        files.add(batch);
        batch = [];
        await options.onProgress?.(indexed);
      }
    }
    files.add(batch);
    await options.onProgress?.(indexed);
    const names = new Map<string, string>();
    const projectsPath = join(tables, "public.projects.jsonl");
    const paths = [sessionsPath, filesPath];
    if (await exists(projectsPath)) {
      paths.push(projectsPath);
      for await (const row of jsonLines(projectsPath)) {
        const parsed = z.object({ id: z.string(), name: z.string() }).safeParse(row.value);
        if (parsed.success) names.set(parsed.data.id, parsed.data.name);
      }
    }
    const filePath = async (file: ExportedFile) => {
      const segment = (value: string) => Buffer.from(value).toString("base64url");
      const candidates = roots.flatMap((root) => [
        resolve(root, file.storage_path),
        join(root, "storage", file.storage_path),
        join(root, "files", segment(file.project_id), segment(file.id)),
        join(root, "files", file.project_id, file.id),
        join(root, file.project_id, file.id),
      ]);
      for (const candidate of candidates) {
        const actual = await realpath(candidate).catch(() => undefined);
        if (actual && roots.some((root) => inside(root, actual)) && (await exists(actual))) return actual;
      }
      throw new SessionImportError(`File bytes not found inside the backup or storage folder: ${file.id}`);
    };
    const getFile = (id: string, projectId: string) => {
      const file = files.get(id);
      if (!file || file.project_id !== projectId)
        throw new SessionImportError(`Exported file not found for project: ${id}`);
      return file;
    };
    const history = async (session: ExportedSession) => {
      const file = getFile(session.session_file_id, session.project_id);
      const path = await filePath(file);
      const messages = sessionMessageSchema.array().parse(await Bun.file(path).json());
      const attachments = new Map<string, { file: ExportedFile; path: string }>();
      for (const message of messages)
        for (const part of message.parts) {
          if (part.type !== "file" || !part.fileId || attachments.has(part.fileId)) continue;
          const file = getFile(part.fileId, session.project_id);
          attachments.set(file.id, { file, path: await filePath(file) });
        }
      return { messages, attachments };
    };
    return {
      sourcePath,
      sessionsPath,
      names,
      fingerprint: await digest(paths, options.signal),
      history,
      close: files.close,
    };
  } catch (error) {
    await files.close();
    throw error;
  }
};
