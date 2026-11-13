import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { diagnosticRuntime, serializeDiagnosticWrite } from "./state";
import type { DiagnosticRecord } from "./types";

export const RESULT_LIMIT = 16 * 1024 * 1024;
const RETAINED_CAPTURES = 10;
export const missingCapture = (error: unknown) =>
  error !== null &&
  typeof error === "object" &&
  "code" in error &&
  error.code === "ENOENT" &&
  "path" in error &&
  typeof error.path === "string" &&
  error.path.endsWith(".capture.json");
const validId = (id: string) => {
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) throw new Error("Invalid diagnostic capture ID.");
  return id;
};

export const diagnosticDirectory = () =>
  join(
    process.env.PSTDIO_HOME ?? join(homedir(), ".pstdio"),
    "extension-storage",
    "pstdio.pstdio-performance",
    "diagnostics",
  );

const protectDirectory = async (directory: string) => {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink()) throw new Error("Diagnostic directory must not be a symbolic link.");
  if (process.platform === "win32") {
    const account = process.env.USERDOMAIN
      ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
      : process.env.USERNAME;
    if (!account) throw new Error("Cannot identify the Windows owner of the diagnostic directory.");
    const child = Bun.spawn(
      ["icacls", directory, "/inheritance:r", "/grant:r", `${account}:(OI)(CI)F`, "SYSTEM:(OI)(CI)F"],
      { stdout: "ignore", stderr: "pipe" },
    );
    const [error, code] = await Promise.all([new Response(child.stderr).text(), child.exited]);
    if (code !== 0) throw new Error(`Cannot protect diagnostic directory: ${error.trim()}`);
  } else await chmod(directory, 0o700);
};

export const captureFiles = (root: string, projectId: string) => {
  if (!/^[a-z\d_-]{1,128}$/i.test(projectId)) throw new Error("Invalid diagnostic project ID.");
  const directory = join(root, projectId);
  const path = (id: string, kind: "capture" | "result") => join(directory, `${validId(id)}.${kind}.json`);
  const read = async (id: string) => {
    const value = JSON.parse(await readFile(path(id, "capture"), "utf8")) as DiagnosticRecord;
    if (value.id !== id || value.projectId !== projectId) throw new Error("Diagnostic capture owner does not match.");
    return value;
  };
  const write = async (file: string, value: unknown, limit: number) => {
    const content = JSON.stringify(value);
    if (Buffer.byteLength(content) > limit)
      throw new Error("Diagnostic result exceeds its size limit; use a shorter capture.");
    await protectDirectory(directory);
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, content, { mode: 0o600, flag: "wx" });
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
  };
  const list = async () => {
    const names = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    const captures = await Promise.all(
      names
        .filter((name) => name.endsWith(".capture.json"))
        .map((name) =>
          read(name.slice(0, -".capture.json".length)).catch((error: unknown) => {
            if (!missingCapture(error)) throw error;
            return undefined;
          }),
        ),
    );
    return captures
      .filter((capture) => capture !== undefined)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  };
  return {
    read,
    list,
    create: (record: DiagnosticRecord) =>
      serializeDiagnosticWrite(directory, async () => {
        if (record.projectId !== projectId) throw new Error("Diagnostic capture owner does not match.");
        await write(path(record.id, "capture"), record, 64 * 1024);
      }),
    update: (id: string, patch: Partial<DiagnosticRecord>) =>
      serializeDiagnosticWrite(directory, async () => {
        const previous = await read(id);
        const next = { ...previous, ...patch, id, projectId };
        await write(path(id, "capture"), next, 64 * 1024);
        return next;
      }),
    hasResult: async (id: string) => {
      const info = await stat(path(id, "result")).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      return Boolean(info?.isFile());
    },
    writeResult: (id: string, value: unknown) =>
      serializeDiagnosticWrite(directory, async () => {
        await read(id);
        await write(path(id, "result"), value, RESULT_LIMIT);
      }),
    result: async (id: string) => {
      await read(id);
      const file = path(id, "result");
      if ((await stat(file)).size > RESULT_LIMIT) throw new Error("Diagnostic result exceeds its size limit.");
      return JSON.parse(await readFile(file, "utf8")) as unknown;
    },
    prune: (inactiveIds: string[] = []) =>
      serializeDiagnosticWrite(directory, async () => {
        const inactive = new Set(inactiveIds);
        const completed = (await list()).filter(
          (entry) => (entry.finishedAt || inactive.has(entry.id)) && entry.id !== diagnosticRuntime.active,
        );
        for (const entry of completed.slice(RETAINED_CAPTURES)) {
          await rm(path(entry.id, "result"), { force: true });
          await rm(path(entry.id, "capture"), { force: true });
        }
      }),
  };
};
