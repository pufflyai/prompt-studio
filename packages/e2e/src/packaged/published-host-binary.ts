import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";

const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const TEMPORARY_DOWNLOAD_STATUSES = new Set([502, 503, 504]);

export const hostBinaryName = () => {
  const platform = process.platform === "win32" ? "win" : process.platform;
  return `pstdio-${platform}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`;
};

const fetchHostBinary = async (tag: string, name: string) => {
  const url = `https://github.com/pufflyai/prompt-studio/releases/download/${encodeURIComponent(tag)}/${name}`;
  const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { signal });
    if (response.ok) return response;

    const error = new Error(`Cannot download ${tag} host: HTTP ${response.status}`);
    await response.body?.cancel().catch(() => {});
    if (attempt === DOWNLOAD_ATTEMPTS || !TEMPORARY_DOWNLOAD_STATUSES.has(response.status)) throw error;

    console.warn(`${error.message}. Retrying release asset download (attempt ${attempt + 1}/${DOWNLOAD_ATTEMPTS})`);
    await setTimeout(attempt * 1_000, undefined, { signal });
  }
};

/** Downloads one published `pstdio` binary into a cache folder once and verifies its checksum. */
export const downloadHostBinary = async (input: { tag: string; cacheFolder: string; sha256: string }) => {
  const name = hostBinaryName();
  const directory = join(tmpdir(), input.cacheFolder);
  await mkdir(directory, { recursive: true });
  const path = join(directory, name);
  if (!(await Bun.file(path).exists())) {
    const response = await fetchHostBinary(input.tag, name);
    // An interrupted download must not leave a truncated binary that fails every later run.
    const partial = `${path}.${randomUUID()}.partial`;
    try {
      await Bun.write(partial, response);
      await rename(partial, path);
    } finally {
      await rm(partial, { force: true });
    }
  }
  const actual = createHash("sha256")
    .update(new Uint8Array(await Bun.file(path).arrayBuffer()))
    .digest("hex");
  if (actual !== input.sha256) throw new Error(`Published host checksum mismatch: ${input.tag} ${name}`);
  await chmod(path, 0o700);
  return path;
};

export const versionFromTag = (tag: string) => {
  if (!/^pstdio@\d+\.\d+\.\d+(?:-nightly\.\d+)?$/.test(tag))
    throw new Error(`Invalid Prompt Studio release tag: ${tag}`);
  return tag.slice("pstdio@".length);
};

export const preparePublishedHost = async (tag: string) => {
  versionFromTag(tag);
  const checksumsUrl = `https://github.com/pufflyai/prompt-studio/releases/download/${encodeURIComponent(tag)}/checksums.sha256`;
  const checksums = await fetch(checksumsUrl);
  if (!checksums.ok) throw new Error(`Cannot download ${tag} checksums: HTTP ${checksums.status}`);
  const name = hostBinaryName();
  const sha256 = (await checksums.text())
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .find(([, file]) => file === name)?.[0];
  if (!sha256 || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`${tag} publishes no checksum for ${name}`);
  const path = await downloadHostBinary({ tag, cacheFolder: `pstdio-${tag}`, sha256 });
  return { tag, path };
};
