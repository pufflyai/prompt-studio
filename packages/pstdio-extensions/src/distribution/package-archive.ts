import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";

export const createPackageArchive = async (files: Record<string, Uint8Array>) => {
  const archive = pack();
  // Immutable package hashes describe contents, so time and local file metadata cannot enter the archive.
  for (const name of Object.keys(files).sort()) {
    archive.entry({ name, type: "file", mode: 0o644, mtime: new Date(0) }, Buffer.from(files[name]!));
  }
  archive.finalize();
  return new Uint8Array(gzipSync(await buffer(archive)));
};

import { buffer } from "node:stream/consumers";
