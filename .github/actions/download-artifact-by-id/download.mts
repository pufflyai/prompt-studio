import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { inflateRawSync } from "node:zlib";
import { apiError, createResultsClient, type ResultsContext } from "./results.mts";
import { attempts, pause, readBody, request, type TransferOptions, TransientTransferError } from "./transfer.mts";

export interface DownloadOptions extends TransferOptions {
  artifactIds: string;
  runId: string;
  path: string;
  mergeMultiple: boolean;
  token: string;
  repository: string;
  apiUrl: string;
  results?: ResultsContext;
  log?: (line: string) => void;
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

const fetchRestArtifact = async (options: DownloadOptions, id: string, headers: Record<string, string>) => {
  const api = `${options.apiUrl}/repos/${options.repository}/actions/artifacts/${id}`;
  const metadata = await request(options, api, { headers });
  if (metadata.status === 404) throw new Error(`Artifact ${id} was not found in ${options.repository}`);
  if (!metadata.ok) throw new Error(`Cannot read artifact ${id}: ${await apiError(metadata)}`);
  const artifact = (await metadata.json()) as ArtifactMetadata;
  if (artifact.expired) throw new Error(`Artifact ${id} (${artifact.name}) expired at ${artifact.expires_at}`);
  if (options.runId && String(artifact.workflow_run.id) !== options.runId)
    throw new Error(
      `Artifact ${id} (${artifact.name}) belongs to run ${artifact.workflow_run.id}, not ${options.runId}`,
    );
  let response = await request(options, `${api}/zip`, { headers, redirect: "manual" });
  const location = response.headers.get("location");
  // The signed storage URL must not receive the repository token.
  if (response.status >= 300 && response.status < 400 && location) response = await request(options, location, {});
  if (!response.ok) throw new Error(`Cannot download artifact ${id}: ${await apiError(response)}`);
  return {
    name: artifact.name,
    digest: artifact.digest,
    runId: String(artifact.workflow_run.id),
    zip: await readBody(options, response),
  };
};

const fetchResultsArtifact = async (options: DownloadOptions, results: ResultsContext, id: string) => {
  const client = createResultsClient(options, results, ` for artifact ${id}`);
  // Protobuf JSON encodes Int64Value as a decimal string rather than a JSON object or number.
  const exactId = BigInt(id).toString();
  const artifacts = await client.list({ id_filter: exactId });
  const [artifact] = artifacts;
  if (!artifact) throw new Error(`Artifact ${id} was not found in ${options.repository} run ${options.runId}`);
  if (artifacts.length !== 1 || artifact.id !== exactId)
    throw new Error(`Actions Results returned an unexpected identity for artifact ${id}`);
  const url = await client.signedUrl(artifact);
  const response = await request(options, url, {});
  if (!response.ok) throw new Error(`Cannot download artifact ${id}: ${await apiError(response)}`);
  return { name: artifact.name, digest: artifact.digest, runId: results.runId, zip: await readBody(options, response) };
};

// Like download-artifact, restart a dropped or stalled transfer with a fresh signed URL.
const downloadArtifact = async (options: DownloadOptions, id: string, headers: Record<string, string>) => {
  const { results, runId, repository } = options;
  const sameRun = results && results.runId === runId && results.repository.toLowerCase() === repository.toLowerCase();
  for (let attempt = 1; ; attempt++) {
    try {
      if (sameRun) return await fetchResultsArtifact(options, results, id);
      return await fetchRestArtifact(options, id, headers);
    } catch (error) {
      if (!(error instanceof TransientTransferError) || attempt === attempts) throw error;
      (options.log ?? console.log)(`Retrying artifact ${id} after attempt ${attempt}: ${error.message}`);
      await pause(options, 2000 * attempt);
    }
  }
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
    const { name, digest, runId, zip } = await downloadArtifact(options, id, headers);
    if (digest && digest !== `sha256:${createHash("sha256").update(zip).digest("hex")}`)
      log(`::warning::Artifact '${name}' digest validation failed. Please verify the integrity of the artifact.`);
    const target = options.mergeMultiple ? destination : join(destination, name);
    const files = extractZip(zip, target);
    log(`Downloaded ${name} (ID ${id}, run ${runId}, ${files} files) to ${target}`);
    downloaded.push({ id, name, path: target, files });
  }
  return downloaded;
};
