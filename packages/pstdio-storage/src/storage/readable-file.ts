import { link, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";

export const readableFileDirectory = (storagePath: string) => `${storagePath}.readable`;

export const readableFilePath = async (storagePath: string, fileName: string) => {
  const directory = readableFileDirectory(storagePath);
  await mkdir(directory, { recursive: true });
  const path = join(directory, basename(fileName));
  try {
    // A sibling hard link keeps the filename without copying bytes or requiring
    // Windows symlink privileges. Both names share the stored file's lifetime.
    await link(storagePath, path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return path;
};
