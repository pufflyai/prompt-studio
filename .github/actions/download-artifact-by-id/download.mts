import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { inflateRawSync } from "node:zlib";

export interface DownloadOptions {
  artifactIds: string;
  runId: string;
  path: string;
  mergeMultiple: boolean;
  token: string;
  repository: string;
  apiUrl: string;
  fetch?: typeof fetch;
  log?: (line: string) => void;
  retryDelayMs?: number;
}

interface ArtifactMetadata {
  name: string;
  expired: boolean;
  expires_at: string;
  digest?: string;
  workflow_run: { id: number };
}

export const parseArtifactIds = (value: string) => {
  const ids = value
    .split(/[,\n]/)
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length) throw new Error("No artifact IDs were provided");
  for (const id of ids)
    if (!/^\d+$/.test(id)) throw new Error(`Invalid artifact ID '${id}'. Artifact IDs are numbers.`);
  return ids;
};

const zipEntries = (zip: Buffer) => {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("The artifact is not a ZIP archive");
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  // Artifacts stay far below the 4 GiB and 65,535-entry limits that would require ZIP64 records.
  if (count === 0xffff || offset === 0xffffffff) throw new Error("ZIP64 artifacts are not supported");
  return Array.from({ length: count }, () => {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("The artifact's ZIP directory is corrupt");
    const nameLength = zip.readUInt16LE(offset + 28);
    const entry = {
      method: zip.readUInt16LE(offset + 10),
      compressedSize: zip.readUInt32LE(offset + 20),
      header: zip.readUInt32LE(offset + 42),
      name: zip.toString("utf8", offset + 46, offset + 46 + nameLength),
    };
    if (entry.compressedSize === 0xffffffff || entry.header === 0xffffffff)
      throw new Error("ZIP64 artifacts are not supported");
    offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
    return entry;
  });
};

export const extractZip = (zip: Buffer, destination: string) => {
  const root = resolve(destination);
  let files = 0;
  mkdirSync(root, { recursive: true });
  for (const entry of zipEntries(zip)) {
    const target = resolve(root, entry.name);
    if (!target.startsWith(root + sep)) throw new Error(`Refusing to extract '${entry.name}' outside ${root}`);
    if (entry.name.endsWith("/")) {
      mkdirSync(target, { recursive: true });
      continue;
    }
    const start = entry.header + 30 + zip.readUInt16LE(entry.header + 26) + zip.readUInt16LE(entry.header + 28);
    const data = zip.subarray(start, start + entry.compressedSize);
    if (entry.method !== 0 && entry.method !== 8)
      throw new Error(`Unsupported ZIP compression method ${entry.method} for '${entry.name}'`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.method === 8 ? inflateRawSync(data) : data);
    files++;
  }
  return files;
};

// download-artifact retried transient API and blob failures; keep that tolerance.
const request = async (options: DownloadOptions, url: string, init: RequestInit) => {
  const fetcher = options.fetch ?? fetch;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetcher(url, init);
      if ((response.status < 500 && response.status !== 429) || attempt === 5) return response;
    } catch (error) {
      if (attempt === 5) throw error;
    }
    await new Promise((done) => setTimeout(done, (options.retryDelayMs ?? 2000) * attempt));
  }
};

const downloadZip = async (options: DownloadOptions, id: string, headers: Record<string, string>) => {
  const url = `${options.apiUrl}/repos/${options.repository}/actions/artifacts/${id}/zip`;
  let response = await request(options, url, { headers, redirect: "manual" });
  const location = response.headers.get("location");
  // The signed storage URL must not receive the repository token.
  if (response.status >= 300 && response.status < 400 && location) response = await request(options, location, {});
  if (!response.ok) throw new Error(`Cannot download artifact ${id}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

export const downloadArtifacts = async (options: DownloadOptions) => {
  const log = options.log ?? console.log;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${options.token}`,
    "User-Agent": "pstdio-download-artifact-by-id",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const destination = resolve(options.path);
  const downloaded: Array<{ id: string; name: string; path: string; files: number }> = [];
  for (const id of parseArtifactIds(options.artifactIds)) {
    const response = await request(options, `${options.apiUrl}/repos/${options.repository}/actions/artifacts/${id}`, {
      headers,
    });
    if (response.status === 404) throw new Error(`Artifact ${id} was not found in ${options.repository}`);
    if (!response.ok) throw new Error(`Cannot read artifact ${id}: HTTP ${response.status}`);
    const artifact = (await response.json()) as ArtifactMetadata;
    if (artifact.expired) throw new Error(`Artifact ${id} (${artifact.name}) expired at ${artifact.expires_at}`);
    if (options.runId && String(artifact.workflow_run.id) !== options.runId)
      throw new Error(
        `Artifact ${id} (${artifact.name}) belongs to run ${artifact.workflow_run.id}, not ${options.runId}`,
      );
    const zip = await downloadZip(options, id, headers);
    if (artifact.digest && artifact.digest !== `sha256:${createHash("sha256").update(zip).digest("hex")}`)
      log(
        `::warning::Artifact '${artifact.name}' digest validation failed. Please verify the integrity of the artifact.`,
      );
    const target = options.mergeMultiple ? destination : join(destination, artifact.name);
    const files = extractZip(zip, target);
    log(`Downloaded ${artifact.name} (ID ${id}, run ${artifact.workflow_run.id}, ${files} files) to ${target}`);
    downloaded.push({ id, name: artifact.name, path: target, files });
  }
  return downloaded;
};
