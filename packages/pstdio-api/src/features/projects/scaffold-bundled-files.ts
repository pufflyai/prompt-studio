import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
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
    transformName?: (name: string) => string;
  },
) => {
  if (existsSync(targetDir)) return;

  if (existsSync(input.bundledSourceDir)) {
    if (input.transformName) {
      mkdirSync(targetDir, { recursive: true });
      for (const entry of readdirSync(input.bundledSourceDir)) {
        copyFileSync(join(input.bundledSourceDir, entry), join(targetDir, input.transformName(entry)));
      }
    } else {
      cpSync(input.bundledSourceDir, targetDir, { recursive: true });
    }
    return;
  }

  const embeddedFiles = listEmbeddedFiles(input.embeddedPrefix);
  if (embeddedFiles.length === 0) return;

  mkdirSync(targetDir, { recursive: true });
  for (const file of embeddedFiles) {
    const name = normalizeEmbeddedRelativePath(file.name.slice(input.embeddedPrefix.length));
    const outPath = join(targetDir, input.transformName ? input.transformName(name) : name);
    mkdirSync(dirname(outPath), { recursive: true });
    await Bun.write(outPath, file);
  }
};
