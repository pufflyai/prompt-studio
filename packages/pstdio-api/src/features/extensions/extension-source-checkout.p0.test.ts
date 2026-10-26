import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createSharedNamedSourceCheckout, prepareGitExtensionSource } from "./extension-source-checkout";

const git = (cwd: string, ...args: string[]) => {
  const result = Bun.spawnSync(["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], { cwd });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
};

const commitVersion = (repo: string, version: string) => {
  writeFileSync(join(repo, "extensions", "demo", "version.txt"), version);
  git(repo, "add", ".");
  git(repo, "commit", "-m", version);
  return git(repo, "rev-parse", "HEAD");
};

describe("prepareGitExtensionSource", () => {
  let root: string;
  let repo: string;
  let firstCommit: string;
  let secondCommit: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pstdio-extension-checkout-test-"));
    repo = join(root, "repo");
    mkdirSync(join(repo, "extensions", "demo"), { recursive: true });
    writeFileSync(join(repo, "outside.txt"), "not part of the extension");
    git(repo, "init", "-b", "main");
    // GitHub serves partial clones; a local repository needs this to honor `--filter=blob:none`.
    // Fetching by SHA needs no extra setting because Git protocol v2 lets clients request any commit.
    git(repo, "config", "uploadpack.allowFilter", "true");
    firstCommit = commitVersion(repo, "first");
    git(repo, "tag", "v1");
    secondCommit = commitVersion(repo, "second");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const checkout = async (ref: string, name: string) => {
    const origin = { kind: "git" as const, url: pathToFileURL(repo).href, path: "extensions/demo", ref };
    const target = join(root, name);
    mkdirSync(target);
    const source = await prepareGitExtensionSource(origin, target, ref);
    return { ...source, version: readFileSync(join(source.path, "version.txt"), "utf8") };
  };

  test("checks out a commit by its full SHA", async () => {
    const source = await checkout(firstCommit, "by-sha");

    expect(source.version).toBe("first");
    expect(source.ref).toContain(`@${firstCommit}#`);
  });

  test("checks out branch and tag names", async () => {
    const branch = await checkout("main", "by-branch");
    const tag = await checkout("v1", "by-tag");

    expect(branch.version).toBe("second");
    expect(branch.ref).toContain(`@${secondCommit}#`);
    expect(tag.version).toBe("first");
    expect(tag.ref).toContain(`@${firstCommit}#`);
  });
});

describe("createSharedNamedSourceCheckout", () => {
  test("passes cancellation to every Git operation", async () => {
    const controller = new AbortController();
    const calls: Array<{ signal?: AbortSignal }> = [];
    const runCommand = mock(async (_command: string, _args: string[], options: { signal?: AbortSignal }) => {
      calls.push(options);
      return { exitCode: 0, stderr: "", stdout: "commit" };
    });
    const checkout = await createSharedNamedSourceCheckout(["pstdio-planner"], {
      hostReleaseRef: "main",
      runCommand,
      signal: controller.signal,
    });

    try {
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((call) => call.signal === controller.signal)).toBe(true);
    } finally {
      checkout.cleanup();
    }
  });

  test("ends git options before the repository URL and ref and allows only https and file transport", async () => {
    const calls: string[][] = [];
    const runCommand = mock(async (_command: string, args: string[]) => {
      calls.push(args);
      return { exitCode: 0, stderr: "", stdout: "commit" };
    });
    const checkout = await createSharedNamedSourceCheckout(["pstdio-planner"], { hostReleaseRef: "main", runCommand });

    try {
      const transportConfig = [
        "-c",
        "protocol.allow=never",
        "-c",
        "protocol.https.allow=always",
        "-c",
        "protocol.file.allow=always",
      ];
      const url = "https://github.com/pufflyai/prompt-studio";
      const addRemote = calls.find((args) => args.includes(url)) ?? [];
      expect(addRemote.indexOf("--")).toBeGreaterThan(-1);
      expect(addRemote.indexOf("--")).toBeLessThan(addRemote.indexOf(url));
      const fetch = calls.find((args) => args.includes("fetch")) ?? [];
      expect(fetch.indexOf("--")).toBeGreaterThan(-1);
      expect(fetch.indexOf("--")).toBeLessThan(fetch.indexOf("main"));
      for (const subcommand of ["fetch", "checkout"]) {
        const call = calls.find((args) => args.includes(subcommand)) ?? [];
        expect(call.slice(0, transportConfig.length)).toEqual(transportConfig);
      }
    } finally {
      checkout.cleanup();
    }
  });
});
