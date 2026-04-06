import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

type EmbeddedFile = Blob & { name: string };

const normalizeEmbeddedRelativePath = (relativePath: string) =>
  relativePath.endsWith(".") ? relativePath.slice(0, -1) : relativePath;

const listEmbeddedFiles = (embeddedPrefix: string) =>
  (Bun.embeddedFiles as EmbeddedFile[]).filter((file) => file.name.startsWith(embeddedPrefix));

const resolveOutputPath = (targetDir: string, name: string, transformName?: (name: string) => string) =>
  join(targetDir, transformName ? transformName(name) : name);

const copyBundledSourceEntries = (
  targetDir: string,
  input: {
    bundledSourceDir: string;
    transformName?: (name: string) => string;
    allowExistingTarget?: boolean;
  },
) => {
  if (!(input.transformName || input.allowExistingTarget)) {
    cpSync(input.bundledSourceDir, targetDir, { recursive: true });
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(input.bundledSourceDir)) {
    const outPath = resolveOutputPath(targetDir, entry, input.transformName);
    if (existsSync(outPath)) continue;
    copyFileSync(join(input.bundledSourceDir, entry), outPath);
  }
};

const writeEmbeddedFiles = async (
  targetDir: string,
  input: {
    embeddedPrefix: string;
    transformName?: (name: string) => string;
  },
) => {
  const embeddedFiles = listEmbeddedFiles(input.embeddedPrefix);
  if (embeddedFiles.length === 0) return;

  mkdirSync(targetDir, { recursive: true });
  for (const file of embeddedFiles) {
    const name = normalizeEmbeddedRelativePath(file.name.slice(input.embeddedPrefix.length));
    const outPath = resolveOutputPath(targetDir, name, input.transformName);
    if (existsSync(outPath)) continue;
    mkdirSync(dirname(outPath), { recursive: true });
    await Bun.write(outPath, file);
  }
};

export const scaffoldBundledFiles = async (
  targetDir: string,
  input: {
    bundledSourceDir: string;
    embeddedPrefix: string;
    transformName?: (name: string) => string;
    allowExistingTarget?: boolean;
  },
) => {
  if (existsSync(targetDir) && !input.allowExistingTarget) return;

  if (existsSync(input.bundledSourceDir)) {
    copyBundledSourceEntries(targetDir, input);
    return;
  }

  await writeEmbeddedFiles(targetDir, input);
};
