import * as fs from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addRemote,
  fetch as fetchRepository,
  type HttpClient,
  init,
  listServerRefs,
  readBlob,
  readObject,
  readTag,
  readTree,
  resolveRef,
} from "isomorphic-git";
import webHttp from "isomorphic-git/http/web";

export const gitCommitPattern = /^[0-9a-f]{40}$/i;

export const isExtensionSourceUrl = (url: string) => {
  try {
    return ["https:", "file:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

const requireSourceUrl = (url: string) => {
  if (!isExtensionSourceUrl(url)) throw new Error("Extension repositories require an HTTPS or file URL");
};

export type ExtensionRepositoryOptions = { http?: HttpClient; signal?: AbortSignal };

const repositoryHttp = ({ http = webHttp, signal }: ExtensionRepositoryOptions): HttpClient => ({
  request: async (request) => {
    signal?.throwIfAborted();
    requireSourceUrl(request.url);
    const response = await http.request({ ...request, signal });
    signal?.throwIfAborted();
    return response;
  },
});

const refCandidates = (ref: string) =>
  ref === "HEAD" || ref.startsWith("refs/") ? [ref] : [`refs/tags/${ref}`, `refs/heads/${ref}`];

const peelCommit = async (gitdir: string, oid: string, cache = {}) => {
  while (true) {
    const object = await readObject({ fs, gitdir, oid, cache });
    if (object.type === "commit") return oid;
    if (object.type !== "tag") throw new Error(`Extension ref does not name a commit: ${oid}`);
    oid = (await readTag({ fs, gitdir, oid, cache })).tag.object;
  }
};

const localCommit = async (gitdir: string, ref: string, cache = {}) => {
  if (gitCommitPattern.test(ref)) return peelCommit(gitdir, ref.toLowerCase(), cache);
  for (const candidate of refCandidates(ref)) {
    let oid: string;
    try {
      oid = await resolveRef({ fs, gitdir, ref: candidate });
    } catch {
      continue;
    }
    return peelCommit(gitdir, oid, cache);
  }
  throw new Error(`Could not resolve ${ref}`);
};

const localGitDirectory = async (url: string) => {
  const directory = fileURLToPath(url);
  // Accept both working repositories and bare repositories without touching their index or refs.
  return fs.existsSync(join(directory, ".git")) ? join(directory, ".git") : directory;
};

export const resolveExtensionRepositoryRef = async (
  url: string,
  ref: string,
  options: ExtensionRepositoryOptions = {},
) => {
  options.signal?.throwIfAborted();
  requireSourceUrl(url);
  if (gitCommitPattern.test(ref)) return ref.toLowerCase();
  if (url.startsWith("file:")) return localCommit(await localGitDirectory(url), ref);
  const refs = await listServerRefs({
    http: repositoryHttp(options),
    url,
    protocolVersion: 1,
    peelTags: true,
  });
  options.signal?.throwIfAborted();
  for (const candidate of refCandidates(ref)) {
    const match = refs.find((entry) => entry.ref === candidate);
    if (match) return match.peeled ?? match.oid;
  }
  throw new Error(`Could not resolve ${ref}`);
};

const safePath = (path: string) =>
  path.length > 0 &&
  !/[\\:]/.test(path) &&
  !path.split("/").some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git");

// Read only the selected trees. No checkout, hooks, credentials helper or Git executable is run.
const writeTree = async (gitdir: string, oid: string, target: string, signal?: AbortSignal, cache = {}) => {
  const { tree } = await readTree({ fs, gitdir, oid, cache });
  await mkdir(target, { recursive: true });
  for (const entry of tree) {
    signal?.throwIfAborted();
    if (!safePath(entry.path) || entry.path.includes("/")) throw new Error(`Unsafe extension path: ${entry.path}`);
    const destination = join(target, entry.path);
    if (entry.type === "tree") await writeTree(gitdir, entry.oid, destination, signal, cache);
    else if (entry.type === "blob" && ["100644", "100755"].includes(entry.mode)) {
      const { blob } = await readBlob({ fs, gitdir, oid: entry.oid, cache });
      await writeFile(destination, blob, { mode: entry.mode === "100755" ? 0o755 : 0o644, signal });
    } else throw new Error(`Extension source cannot include links or submodules: ${entry.path}`);
  }
};

export const prepareExtensionRepository = async (
  target: string,
  paths: string[],
  url: string,
  ref = "HEAD",
  options: ExtensionRepositoryOptions = {},
) => {
  options.signal?.throwIfAborted();
  requireSourceUrl(url);
  for (const path of paths) {
    if (path !== "." && !safePath(path)) throw new Error(`Unsafe extension source path: ${path}`);
  }
  let gitdir: string;
  let commit: string;
  const cache = {};
  if (url.startsWith("file:")) {
    gitdir = await localGitDirectory(url);
    commit = await localCommit(gitdir, ref, cache);
  } else {
    await init({ fs, dir: target });
    await addRemote({ fs, dir: target, remote: "origin", url });
    gitdir = join(target, ".git");
    const result = await fetchRepository({
      fs,
      http: repositoryHttp(options),
      dir: target,
      url,
      ref,
      depth: 1,
      singleBranch: true,
      tags: false,
      cache,
      onProgress: () => options.signal?.throwIfAborted(),
    });
    if (!result.fetchHead) throw new Error(`Could not resolve ${ref}`);
    commit = await peelCommit(gitdir, result.fetchHead, cache);
  }
  for (const path of paths) {
    options.signal?.throwIfAborted();
    const { oid } = await readTree({ fs, gitdir, oid: commit, cache, ...(path !== "." ? { filepath: path } : {}) });
    await writeTree(gitdir, oid, join(target, path), options.signal, cache);
  }
  return commit;
};
