import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeEmbeddedFileName, resolvePstdioHome } from "pstdio-paths";

const DRIZZLE_PREFIX = "../../pstdio-db/drizzle/";

type EmbeddedMigrationFile = {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export const resolveMigrationsFolder = async (
  options: {
    embeddedFiles?: readonly EmbeddedMigrationFile[];
    homePath?: string;
    logger?: (message: string) => void;
  } = {},
) => {
  const embedded = (options.embeddedFiles ?? []).filter((file) =>
    normalizeEmbeddedFileName(file.name).startsWith(DRIZZLE_PREFIX),
  );
  if (embedded.length === 0) {
    return { path: join(dirname(fileURLToPath(import.meta.url)), "../../drizzle"), cleanup: () => {} };
  }

  const home = options.homePath ?? resolvePstdioHome();
  mkdirSync(home, { recursive: true, mode: 0o700 });
  chmodSync(home, 0o700);
  // Each runtime owns its extraction. A shared path lets another run replace SQL before migration.
  const root = mkdtempSync(join(home, "pstdio-drizzle-"));
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  try {
    for (const file of embedded) {
      const relativePath = normalizeEmbeddedFileName(file.name).slice(DRIZZLE_PREFIX.length);
      const outPath = join(root, relativePath);
      mkdirSync(dirname(outPath), { recursive: true, mode: 0o700 });
      (options.logger ?? console.log)(`[drizzle] extracting ${relativePath} (${file.size} bytes)`);
      writeFileSync(outPath, Buffer.from(await file.arrayBuffer()), { mode: 0o600 });
    }
    return { path: root, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
};
