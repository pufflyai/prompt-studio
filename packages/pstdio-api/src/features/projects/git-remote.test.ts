import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cloneGitRemote, readGitRemote, sameRepository } from "./git-remote";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const repository = async (...config: string[][]) => {
  const root = await mkdtemp(join(tmpdir(), "git-remote-"));
  roots.push(root);
  Bun.spawnSync(["git", "init", "-q"], { cwd: root });
  for (const args of config) Bun.spawnSync(["git", ...args], { cwd: root });
  return root;
};

test("the recorded remote never carries credentials", async () => {
  const withToken = await repository([
    "remote",
    "add",
    "origin",
    "https://ci:secret-token@example.test/acme/notes.git",
  ]);
  expect(await readGitRemote(withToken)).toBe("https://example.test/acme/notes.git");

  // A rewrite rule that adds a token stays local to this machine.
  const rewritten = await repository(
    ["remote", "add", "origin", "https://example.test/acme/notes.git"],
    ["config", "url.https://x-access-token:secret@example.test/.insteadOf", "https://example.test/"],
  );
  expect(await readGitRemote(rewritten)).toBe("https://example.test/acme/notes.git");

  // An ssh address keeps its user, which names the account to sign in as, but never a password.
  const sshPassword = await repository(["remote", "add", "origin", "ssh://git:secret@example.test/acme/notes.git"]);
  expect(await readGitRemote(sshPassword)).toBe("ssh://git@example.test/acme/notes.git");
});

test("a folder without a git origin has no recorded remote", async () => {
  const root = await mkdtemp(join(tmpdir(), "git-remote-none-"));
  roots.push(root);
  expect(await readGitRemote(root)).toBeUndefined();
  expect(await readGitRemote(await repository())).toBeUndefined();
});

test("ssh and https addresses of one repository match", () => {
  expect(sameRepository("git@github.com:acme/notes.git", "https://github.com/acme/notes")).toBe(true);
  expect(sameRepository("ssh://git@GitHub.com/acme/notes.git/", "https://github.com/acme/notes.git")).toBe(true);
  expect(sameRepository("git@github.com:acme/notes.git", "https://github.com/acme/other.git")).toBe(false);
  expect(sameRepository("/srv/git/notes", "/srv/git/notes/")).toBe(true);
});

test("a failed clone never shows the remote's credentials", async () => {
  const root = await mkdtemp(join(tmpdir(), "git-remote-"));
  roots.push(root);
  const target = join(root, "checkout");
  const error = await cloneGitRemote("https://ci:secret-token@127.0.0.1:9/acme/notes.git", target).catch(
    (cause: Error) => cause,
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).not.toContain("secret-token");
});
