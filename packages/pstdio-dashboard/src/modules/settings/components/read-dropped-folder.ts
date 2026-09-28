// Installed dependencies and version history are not part of an extension's source. The host
// installs dependencies itself.
const skippedDirectories = new Set(["node_modules", ".git"]);

const readBatch = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));

// A directory reader returns its entries in batches and signals the end with an empty one.
const readAllEntries = async (directory: FileSystemDirectoryEntry) => {
  const reader = directory.createReader();
  const entries: FileSystemEntry[] = [];
  for (let batch = await readBatch(reader); batch.length > 0; batch = await readBatch(reader)) {
    entries.push(...batch);
  }
  return entries;
};

const readFile = (entry: FileSystemFileEntry) => new Promise<File>((resolve, reject) => entry.file(resolve, reject));

const collectFiles = async (directory: FileSystemDirectoryEntry, prefix: string): Promise<File[]> => {
  const files: File[] = [];
  for (const entry of await readAllEntries(directory)) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory && !skippedDirectories.has(entry.name)) {
      files.push(...(await collectFiles(entry as FileSystemDirectoryEntry, `${path}/`)));
    }
    if (entry.isFile) {
      const file = await readFile(entry as FileSystemFileEntry);
      files.push(new File([file], path, { type: file.type }));
    }
  }
  return files;
};

/** Reads a dropped directory. Each returned file is named by its path relative to the directory. */
export const readDroppedFolder = async (directory: FileSystemDirectoryEntry) => ({
  name: directory.name,
  files: await collectFiles(directory, ""),
});
