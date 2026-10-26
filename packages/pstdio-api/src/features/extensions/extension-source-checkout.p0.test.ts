import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareExtensionRepository, resolveExtensionRepositoryRef } from "./extension-repository";
import { serveExtensionRepository } from "./extension-repository.test-fixture";
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
    // Match GitHub's smart HTTP support for fetching an older commit by SHA.
    git(repo, "config", "uploadpack.allowReachableSHA1InWant", "true");
    for (const name of ["pstdio-planner", "pstdio-skills"]) {
      mkdirSync(join(repo, "extensions", name));
      writeFileSync(join(repo, "extensions", name, "version.txt"), name);
    }
    firstCommit = commitVersion(repo, "first");
    git(repo, "tag", "v1");
    git(repo, "tag", "-a", "annotated-v1", "-m", "Annotated release");
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
    expect(existsSync(join(source.path, "../../outside.txt"))).toBe(false);
  });

  test("checks out branch and tag names", async () => {
    const branch = await checkout("main", "by-branch");
    const tag = await checkout("v1", "by-tag");

    expect(branch.version).toBe("second");
    expect(branch.ref).toContain(`@${secondCommit}#`);
    expect(tag.version).toBe("first");
    expect(tag.ref).toContain(`@${firstCommit}#`);
  });

  test("resolves annotated tags to their commit without changing the original repository", async () => {
    const source = await checkout("annotated-v1", "annotated");
    expect(source.version).toBe("first");
    expect(source.ref).toContain(`@${firstCommit}#`);
    expect(await resolveExtensionRepositoryRef(pathToFileURL(repo).href, "annotated-v1")).toBe(firstCommit);
    expect(git(repo, "rev-parse", "HEAD")).toBe(secondCommit);
    expect(git(repo, "status", "--porcelain")).toBe("");
  });

  test("downloads branches and annotated tags over HTTPS and records their commit", async () => {
    const fixture = serveExtensionRepository(repo);
    try {
      for (const [ref, commit] of [
        ["main", secondCommit],
        ["annotated-v1", firstCommit],
      ] as const) {
        expect(
          await resolveExtensionRepositoryRef("https://example.test/repository", ref, { http: fixture.http }),
        ).toBe(commit);
        const target = join(root, ref);
        expect(
          await prepareExtensionRepository(target, ["extensions/demo"], "https://example.test/repository", ref, {
            http: fixture.http,
          }),
        ).toBe(commit);
        expect(readFileSync(join(target, "extensions/demo/version.txt"), "utf8")).toBe(
          ref === "main" ? "second" : "first",
        );
        expect(existsSync(join(target, "outside.txt"))).toBe(false);
      }
    } finally {
      await fixture.server.stop(true);
    }
  });

  test("shares one repository download between named extensions and removes it after installation", async () => {
    const fixture = serveExtensionRepository(repo);
    const checkout = await createSharedNamedSourceCheckout(["pstdio-planner", "pstdio-skills"], {
      hostReleaseRef: "main",
      http: fixture.http,
    });
    try {
      const planner = await checkout.prepareNamedSource("pstdio-planner", "");
      const skills = await checkout.prepareNamedSource("pstdio-skills", "");
      expect(readFileSync(join(planner.path, "version.txt"), "utf8")).toBe("pstdio-planner");
      expect(readFileSync(join(skills.path, "version.txt"), "utf8")).toBe("pstdio-skills");
      expect(planner.ref).toContain(`@${secondCommit}#`);
      expect(skills.ref).toContain(`@${secondCommit}#`);
      expect(fixture.calls.filter((method) => method === "POST")).toHaveLength(1);
      checkout.cleanup();
      expect(existsSync(planner.path)).toBe(false);
    } finally {
      checkout.cleanup();
      await fixture.server.stop(true);
    }
  });

  test("cancels an active HTTP request", async () => {
    const fixture = serveExtensionRepository(repo);
    const controller = new AbortController();
    try {
      await expect(
        prepareExtensionRepository(
          join(root, "cancelled"),
          ["extensions/demo"],
          "https://example.test/repository",
          "main",
          {
            signal: controller.signal,
            http: {
              request: (request) => {
                const pending = fixture.http.request(request);
                queueMicrotask(() => controller.abort());
                return pending;
              },
            },
          },
        ),
      ).rejects.toThrow();
      expect(existsSync(join(root, "cancelled/extensions/demo"))).toBe(false);
    } finally {
      await fixture.server.stop(true);
    }
  });

  test("rejects source paths outside the requested repository tree", async () => {
    for (const path of ["../outside", "/absolute", "extensions/../../outside", "extensions\\demo", "C:/outside"]) {
      await expect(
        prepareExtensionRepository(join(root, "unsafe"), [path], pathToFileURL(repo).href, firstCommit),
      ).rejects.toThrow("Unsafe extension source path");
    }
    expect(existsSync(join(root, "unsafe"))).toBe(false);
  });

  test("refuses symlinks instead of following them outside the extension", async () => {
    const blob = git(repo, "hash-object", "-w", "outside.txt");
    git(repo, "update-index", "--add", "--cacheinfo", `120000,${blob},extensions/demo/link`);
    git(repo, "commit", "-m", "Link outside the extension");
    await expect(checkout("main", "with-link")).rejects.toThrow("cannot include links or submodules");
  });

  test("prepares extension sources when Git is unavailable on PATH", async () => {
    const modulePath = join(import.meta.dirname, "extension-source-checkout.ts");
    const fixture = serveExtensionRepository(repo);
    const origin = { kind: "git", url: "https://example.test/repository", path: "extensions/demo", ref: firstCommit };
    const child = Bun.spawn(
      [
        process.execPath,
        "-e",
        `
      import { prepareGitExtensionSource } from ${JSON.stringify(modulePath)};
      const request = globalThis.fetch;
      globalThis.fetch = (url, options) => {
        const source = new URL(url);
        return request(new URL(source.pathname + source.search, ${JSON.stringify(fixture.server.url.href)}), options);
      };
      const source = await prepareGitExtensionSource(${JSON.stringify(origin)}, ${JSON.stringify(join(root, "without-git"))}, ${JSON.stringify(firstCommit)});
      console.log(await Bun.file(source.path + "/version.txt").text());
      console.log(source.ref);
    `,
      ],
      {
        env: { ...process.env, PATH: join(root, "no-executables") },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    try {
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(code, stderr + fixture.errors.join("\n")).toBe(0);
      expect(stdout).toContain("first");
      expect(stdout).toContain(`@${firstCommit}#`);
      expect(fixture.calls).toContain("POST");
    } finally {
      await fixture.server.stop(true);
    }
  });
});

describe("createSharedNamedSourceCheckout", () => {
  test("stops a cancelled source download before making a request", async () => {
    const controller = new AbortController();
    controller.abort(new Error("Installation cancelled"));
    await expect(
      createSharedNamedSourceCheckout(["pstdio-planner"], {
        hostReleaseRef: "main",
        signal: controller.signal,
      }),
    ).rejects.toThrow("Installation cancelled");
  });
});
