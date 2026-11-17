import { expect } from "bun:test";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readdir, readlink } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import type { ProjectFolderSource } from "pstdio-api-contracts";
import { startPackagedServe } from "./packaged-serve-helpers";

export const waitFor = async (condition: () => Promise<boolean> | boolean) => {
  while (!(await condition())) await Bun.sleep(25);
};

/** Polls until `read` returns a value that `ready` accepts, and returns it. */
export const waitForValue = async <T>(
  read: () => Promise<T | undefined>,
  ready: (value: T | undefined) => boolean = (value) => !!value,
) => {
  for (;;) {
    const value = await read();
    if (ready(value)) return value as T;
    await Bun.sleep(25);
  }
};

/** A local TLS identity for the peer: the host only accepts https account services. */
export const writeCertificate = (root: string) => {
  const key = join(root, "peer-key.pem");
  const cert = join(root, "peer-cert.pem");
  const subject = ["-subj", "/CN=localhost", "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost"];
  const options = ["-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1"];
  expect(Bun.spawnSync(["openssl", "req", ...options, ...subject]).exitCode).toBe(0);
  return { key, cert };
};

/** One compiled host with its own home, as a separate computer has. */
export const startFolderDevice = async (home: string, env: Record<string, string>) => {
  await mkdir(home, { recursive: true });
  const host = await startPackagedServe(home, env);
  const client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
  return { home, host, client };
};
export type FolderDevice = Awaited<ReturnType<typeof startFolderDevice>>;

/** Completes sign-in the way a browser does; the one-use code picks the peer account. */
export const signInDevice = async (device: FolderDevice, origin: string, code = "one-use") => {
  const login = await device.client.account.login(origin);
  const url = new URL(login.url);
  const callback = new URL(url.searchParams.get("callback")!);
  callback.searchParams.set("state", url.searchParams.get("state")!);
  callback.searchParams.set("code", code);
  expect((await fetch(callback)).status).toBe(200);
  await waitFor(async () => !!(await device.client.account.status()).login);
  return (await device.client.account.status()).login!.deviceId;
};

/** This device's own copy once it completed, uploaded and entered the account's catalog. */
export const ownCopy = async (device: FolderDevice, projectId: string) => {
  const copy = (await device.client.projects.folderSources(projectId)).find((source) => source.current);
  return copy?.available ? copy : undefined;
};

export const listedCopy = async (device: FolderDevice, projectId: string, deviceId: string) =>
  (await device.client.projects.folderSources(projectId).catch(() => [] as ProjectFolderSource[])).find(
    (source) => source.deviceId === deviceId,
  );

const fileDigest = (path: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });

/**
 * Every entry below a folder with its type, permission bits and exact bytes or link text.
 * `skip` leaves out names whose subtree is not part of the comparison.
 */
export const snapshotTree = async (root: string, skip: (path: string) => boolean = () => false) => {
  const entries: Record<string, string> = {};
  const walk = async (relative: string) => {
    for (const name of (await readdir(join(root, relative))).sort()) {
      const path = relative ? `${relative}/${name}` : name;
      if (skip(path)) continue;
      const absolute = join(root, path);
      const stat = await lstat(absolute);
      const mode = (stat.mode & 0o777).toString(8);
      if (stat.isSymbolicLink()) entries[path] = `link ${await readlink(absolute)}`;
      else if (stat.isDirectory()) {
        entries[path] = `dir ${mode}`;
        await walk(path);
      } else entries[path] = `file ${mode} ${stat.size} ${await fileDigest(absolute)}`;
    }
  };
  await walk("");
  return entries;
};

/** Git read commands that never write optional locks or read this machine's global settings. */
export const gitOutput = (cwd: string, ...args: string[]) => {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString();
};
