import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

type EmbeddedFile = Blob & { name: string };

const normalizeEmbeddedRelativePath = (relativePath: string) =>
  relativePath.endsWith(".") ? relativePath.slice(0, -1) : relativePath;

const listEmbeddedFiles = (embeddedPrefix: string) =>
  (Bun.embeddedFiles as EmbeddedFile[]).filter((file) => file.name.startsWith(embeddedPrefix));

export const scaffoldBundledFiles = async (
  targetDir: string,
  input: {
    bundledSourceDir: string;
    embeddedPrefix: string;
  },
) => {
  if (existsSync(targetDir)) return;

  if (existsSync(input.bundledSourceDir)) {
    cpSync(input.bundledSourceDir, targetDir, { recursive: true });
    return;
  }

  const embeddedFiles = listEmbeddedFiles(input.embeddedPrefix);
  if (embeddedFiles.length === 0) return;

  mkdirSync(targetDir, { recursive: true });
  for (const file of embeddedFiles) {
    const outPath = join(targetDir, normalizeEmbeddedRelativePath(file.name.slice(input.embeddedPrefix.length)));
    mkdirSync(dirname(outPath), { recursive: true });
    await Bun.write(outPath, file);
  }
};
