import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { deflateRawSync } from "node:zlib";
import { type DownloadOptions, downloadArtifacts } from "./download.mts";

const api = "https://api.example.test";
const storage = "https://storage.example.test";
let directory = "";

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "download-artifact-by-id-"));
});
afterEach(() => rm(directory, { recursive: true, force: true }));

const zip = (files: Record<string, string>) => {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const method = name.endsWith("/") ? 0 : 8;
    const data = method === 8 ? deflateRawSync(Buffer.from(text)) : Buffer.alloc(0);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(text.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(text.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directoryBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directoryBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directoryBytes, end]);
};

interface FakeArtifact {
  name: string;
  run: number;
  files: Record<string, string>;
  expired?: boolean;
}

// Serves the two REST endpoints the action uses and records which requests carried the token.
const github = (artifacts: Record<string, FakeArtifact>) => {
  const authorized: string[] = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (new Headers(init?.headers).get("authorization") === "Bearer token") authorized.push(url);
    const blob = url.match(/^https:\/\/storage\.example\.test\/(\d+)$/);
    if (blob) return new Response(zip(artifacts[blob[1]].files));
    const [, id, download] = url.match(/\/repos\/owner\/repo\/actions\/artifacts\/(\d+)(\/zip)?$/) ?? [];
    const artifact = artifacts[id];
    if (!artifact) return new Response('{"message":"Not Found"}', { status: 404 });
    if (download) return new Response(null, { status: 302, headers: { location: `${storage}/${id}` } });
    const digest = `sha256:${createHash("sha256").update(zip(artifact.files)).digest("hex")}`;
    return Response.json({
      name: artifact.name,
      expired: artifact.expired ?? false,
      expires_at: "2026-11-01T00:00:00Z",
      digest,
      workflow_run: { id: artifact.run },
    });
  };
  return { fetcher: fetcher as typeof fetch, authorized };
};

const options = (fetcher: typeof fetch, overrides: Partial<DownloadOptions>): DownloadOptions => ({
  artifactIds: "",
  runId: "",
  path: directory,
  mergeMultiple: false,
  token: "token",
  repository: "owner/repo",
  apiUrl: api,
  fetch: fetcher,
  log: () => {},
  ...overrides,
});

const tree = async (root: string) =>
  Object.fromEntries(
    await Promise.all(
      (await readdir(root, { recursive: true, withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const file = join(entry.parentPath, entry.name);
          return [relative(root, file).replaceAll("\\", "/"), await readFile(file, "utf8")];
        }),
    ),
  );

const artifacts = {
  "200": { name: "plan", run: 7, files: { "plan.json": '{"jobs":[]}', "nested/": "", "nested/a.txt": "a" } },
  "300": { name: "identity", run: 7, files: { "production-candidate.json": "{}" } },
};

test("each artifact downloads by ID into its own named folder without the token reaching storage", async () => {
  const { fetcher, authorized } = github(artifacts);
  await downloadArtifacts(options(fetcher, { artifactIds: "200, 300", runId: "7" }));

  expect(await tree(directory)).toEqual({
    "plan/plan.json": '{"jobs":[]}',
    "plan/nested/a.txt": "a",
    "identity/production-candidate.json": "{}",
  });
  expect(authorized.some((url) => url.startsWith(storage))).toBe(false);
});

test("merge-multiple extracts every artifact directly into the path", async () => {
  const { fetcher } = github(artifacts);
  await downloadArtifacts(options(fetcher, { artifactIds: "200\n300", mergeMultiple: true }));

  expect(await tree(directory)).toEqual({
    "plan.json": '{"jobs":[]}',
    "nested/a.txt": "a",
    "production-candidate.json": "{}",
  });
});

test("a missing, expired or other-run artifact fails clearly", async () => {
  const { fetcher } = github({ ...artifacts, "400": { name: "old", run: 7, files: {}, expired: true } });

  await expect(downloadArtifacts(options(fetcher, { artifactIds: "999" }))).rejects.toThrow(
    "Artifact 999 was not found in owner/repo",
  );
  await expect(downloadArtifacts(options(fetcher, { artifactIds: "400" }))).rejects.toThrow(
    "Artifact 400 (old) expired at 2026-11-01T00:00:00Z",
  );
  await expect(downloadArtifacts(options(fetcher, { artifactIds: "200", runId: "8" }))).rejects.toThrow(
    "Artifact 200 (plan) belongs to run 7, not 8",
  );
});

test("an archive entry cannot escape the destination", async () => {
  const { fetcher } = github({ "500": { name: "unsafe", run: 7, files: { "../escape.txt": "x" } } });

  await expect(downloadArtifacts(options(fetcher, { artifactIds: "500", mergeMultiple: true }))).rejects.toThrow(
    "Refusing to extract '../escape.txt'",
  );
});
