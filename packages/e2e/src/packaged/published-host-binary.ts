import { createHash } from "node:crypto";
import { chmod, mkdir, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const hostBinaryName = () => {
  const platform = process.platform === "win32" ? "win" : process.platform;
  return `pstdio-${platform}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`;
};

/** Downloads one published `pstdio` binary into a cache folder once and verifies its checksum. */
export const downloadHostBinary = async (input: { tag: string; cacheFolder: string; sha256: string }) => {
  const name = hostBinaryName();
  const directory = join(tmpdir(), input.cacheFolder);
  await mkdir(directory, { recursive: true });
  const path = join(directory, name);
  if (!(await Bun.file(path).exists())) {
    const url = `https://github.com/pufflyai/prompt-studio/releases/download/${encodeURIComponent(input.tag)}/${name}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Cannot download ${input.tag} host: HTTP ${response.status}`);
    // An interrupted download must not leave a truncated binary that fails every later run.
    await Bun.write(`${path}.partial`, response);
    await rename(`${path}.partial`, path);
  }
  const actual = createHash("sha256")
    .update(new Uint8Array(await Bun.file(path).arrayBuffer()))
    .digest("hex");
  if (actual !== input.sha256) throw new Error(`Published host checksum mismatch: ${input.tag} ${name}`);
  await chmod(path, 0o700);
  return path;
};
