import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { relativeEmbeddedFileName } from "pstdio-paths";

export type EmbeddedFile = Blob & { name: string };
// Bun's embedded file objects are runtime-specific; narrowing the contract keeps extraction testable
// without depending on full Blob behavior that unit tests do not control.
type EmbeddedMigrationFile = Pick<EmbeddedFile, "name" | "size" | "arrayBuffer">;

const DRIZZLE_EXTRACT_DIR = "pstdio-drizzle";

export const getEmbeddedFiles = (): EmbeddedFile[] => {
  try {
    const files = (Bun as Record<string, unknown>).embeddedFiles;
    if (Array.isArray(files)) return files as EmbeddedFile[];
  } catch {
    // not available
  }
  return [];
};

const extractEmbeddedMigrations = async (
  embeddedFiles: readonly { file: EmbeddedMigrationFile; relativePath: string }[],
  root: string,
  logger: (message: string) => void,
) => {
  for (const { file, relativePath } of embeddedFiles) {
    const outPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    logger(`[drizzle] extracting ${relativePath} (${file.size} bytes)`);
    const buf = await file.arrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(buf));
  }
};

export const resolveMigrationsFolder = async (
  options: {
    embeddedFiles?: readonly EmbeddedMigrationFile[];
    tmpDir?: string;
    logger?: (message: string) => void;
  } = {},
) => {
  const embeddedSource = options.embeddedFiles ?? getEmbeddedFiles();
  // Schema snapshots belong to migration generation; extracting them delays packaged startup.
  const embedded = embeddedSource.flatMap((file) => {
    const relativePath = relativeEmbeddedFileName(file.name, "pstdio-db/drizzle");
    return relativePath !== undefined && (relativePath.endsWith(".sql") || relativePath === "meta/_journal.json")
      ? [{ file, relativePath }]
      : [];
  });

  if (embedded.length > 0) {
    const root = fs.mkdtempSync(path.join(options.tmpDir ?? os.tmpdir(), `${DRIZZLE_EXTRACT_DIR}-`));
    const dispose = () => fs.rmSync(root, { recursive: true, force: true });
    try {
      await extractEmbeddedMigrations(embedded, root, options.logger ?? console.log);
      return { path: root, dispose };
    } catch (error) {
      dispose();
      throw error;
    }
  }

  return {
    path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle"),
    dispose: () => {},
  };
};

export const withMigrationsFolder = async (run: (folder: string) => Promise<void>) => {
  const migrations = await resolveMigrationsFolder();
  try {
    await run(migrations.path);
  } finally {
    migrations.dispose();
  }
};
