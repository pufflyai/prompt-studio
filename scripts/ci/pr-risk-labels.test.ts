import { describe, expect, test } from "bun:test";
import { finish, type PullRequest, prepare, type Status } from "./pr-risk-labels";

function fixture(labels: string[] = []) {
  let pull: PullRequest = {
    state: "open",
    user: { login: "contributor" },
    head: { sha: "head", ref: "feature/example", repo: { full_name: "owner/repo" } },
    base: { sha: "base", ref: "main", repo: { full_name: "owner/repo" } },
    changed_files: 2,
    labels: labels.map((name) => ({ name })),
  };
  const statuses: Array<{ sha: string } & Status> = [];
  let files = [
    { filename: "packages/sdk/package.json", status: "modified" },
    { filename: "extensions/example/package.json", status: "modified" },
  ];
  let manifests: Record<"base" | "head", Record<string, unknown>> = {
    base: { name: "example", version: "0.35.0", dependencies: { "@pstdio/sdk": "^0.35.0" } },
    head: { name: "example", version: "0.36.0", dependencies: { "@pstdio/sdk": "^0.36.0" } },
  };
  const api = {
    async readPull() {
      return structuredClone(pull);
    },
    async publish(sha: string, status: Status) {
      statuses.push({ sha, ...status });
    },
    async readChangedFiles() {
      return files;
    },
    async readMergeBase() {
      return "base";
    },
    async readManifest(_path: string, ref: string) {
      return manifests[ref as keyof typeof manifests];
    },
  };
  return {
    api,
    statuses,
    setFiles: (next: typeof files) => {
      files = next;
    },
    setManifests: (next: typeof manifests) => {
      manifests = next;
    },
    release: () => {
      pull.user.login = "github-actions[bot]";
      pull.head.ref = "changeset-release/main";
    },
    setPull: (next: Partial<PullRequest>) => {
      pull = { ...pull, ...next };
    },
  };
}

describe("SDK and extension separation", () => {
  test("allows the fixed release group to update SDK and extension versions together", async () => {
    const { api, statuses, release } = fixture(["sdk", "extensions"]);
    release();
    await finish(api, await prepare(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("success");
  });

  test("accepts changelogs, consumed changesets, and the release lockfile", async () => {
    const { api, statuses, release, setFiles, setPull } = fixture(["sdk", "extensions"]);
    release();
    setFiles([
      { filename: "packages/sdk/CHANGELOG.md", status: "modified" },
      { filename: "extensions/example/CHANGELOG.md", status: "added" },
      { filename: ".changeset/release-notes.md", status: "removed" },
      { filename: "bun.lock", status: "modified" },
    ]);
    setPull({ changed_files: 4 });
    await finish(api, await prepare(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("success");
  });

  test("compares release manifests against the merge base when main advances", async () => {
    const { api, statuses, release, setPull } = fixture(["sdk", "extensions"]);
    release();
    const pull = await api.readPull();
    setPull({ base: { ...pull.base, sha: "new-main" } });
    const original = api.readManifest;
    api.readManifest = async (path, ref) =>
      ref === "new-main"
        ? { ...(await original(path, "base")), scripts: { build: "new-build-command" } }
        : original(path, ref);
    await finish(api, await prepare(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("success");
  });

  test.each([
    ["packages/sdk/src/extensions.ts", "modified"],
    ["extensions/example/extension.ts", "modified"],
    ["packages/sdk/package.json", "added"],
    ["packages/sdk/package.json", "renamed"],
    [".changeset/config.json", "modified"],
    [".changeset/new-work.md", "added"],
    [".github/workflows/release.yml", "modified"],
  ])("blocks implementation or unrelated release changes in %s", async (filename, status) => {
    const { api, statuses, release, setFiles, setPull } = fixture(["sdk", "extensions"]);
    release();
    setFiles([{ filename, status }]);
    setPull({ changed_files: 1 });
    await finish(api, await prepare(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("failure");
  });

  test.each([
    { scripts: { postinstall: "execute-code" } },
    { exports: { ".": "./new-entry.ts" } },
    { dependencies: { "new-package": "^1.0.0" } },
    { dependencies: { "@pstdio/sdk": "https://example.com/sdk.tgz" } },
    { engines: { pstdio: "new-contract" } },
  ])("blocks manifest changes outside release versions: %j", async (change) => {
    const { api, statuses, release, setManifests } = fixture(["sdk", "extensions"]);
    release();
    const base = await api.readManifest("", "base");
    const head = await api.readManifest("", "head");
    setManifests({ base, head: { ...head, ...change } });
    await finish(api, await prepare(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("failure");
  });

  test.each(["author", "branch", "fork"])("requires the generated release identity: %s", async (change) => {
    const { api, statuses, release, setPull } = fixture(["sdk", "extensions"]);
    release();
    const pull = await api.readPull();
    if (change === "author") pull.user.login = "contributor";
    if (change === "branch") pull.head.ref = "feature/mixed-change";
    if (change === "fork") pull.head.repo = { full_name: "contributor/repo" };
    setPull(pull);
    await finish(api, await prepare(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("failure");
  });

  test("cannot exempt an incomplete release diff", async () => {
    const { api, statuses, release, setPull } = fixture(["sdk", "extensions"]);
    release();
    setPull({ changed_files: 3 });
    await finish(api, await prepare(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("error");
  });

  test.each(["head", "closed"])("cannot exempt a release changed during manifest reads: %s", async (change) => {
    const { api, statuses, release, setPull } = fixture(["sdk", "extensions"]);
    release();
    const original = api.readManifest;
    api.readManifest = async (path, ref) => {
      const pull = await api.readPull();
      setPull(change === "head" ? { head: { ...pull.head, sha: "new-head" } } : { state: "closed" });
      return original(path, ref);
    };
    await finish(api, await prepare(api), "success", "sdk,extensions");
    expect(statuses.at(-1)).toMatchObject({ sha: "head", state: "error" });
  });

  test.each([
    [[], "success"],
    [["sdk"], "success"],
    [["extensions"], "success"],
    [["sdk", "database", "extension-runtime"], "success"],
    [["sdk", "extensions", "breaking-change"], "failure"],
  ] as const)("evaluates synchronized labels %j", async (labels, state) => {
    const { api, statuses } = fixture([...labels]);
    const snapshot = await prepare(api);
    await finish(api, snapshot, "success", labels.join(","));
    expect(statuses.map((status) => [status.sha, status.state])).toEqual([
      ["head", "pending"],
      ["head", state],
    ]);
  });

  test("uses the current classification after SDK changes are reverted", async () => {
    const { api, statuses, setPull } = fixture(["sdk", "extensions"]);
    const snapshot = await prepare(api);
    setPull({ labels: [{ name: "extensions" }, { name: "needs-migration" }] });
    await finish(api, snapshot, "success", "extensions,needs-migration");
    expect(statuses.at(-1)?.state).toBe("success");
  });

  test.each(["failure", "cancelled", "skipped"])("never passes when classification is %s", async (outcome) => {
    const { api, statuses } = fixture();
    await finish(api, await prepare(api), outcome, "");
    expect(statuses.at(-1)?.state).toBe("error");
  });

  test.each([
    { head: { sha: "new-head", ref: "feature/example", repo: { full_name: "owner/repo" } } },
    { base: { sha: "new-base", ref: "main", repo: { full_name: "owner/repo" } } },
    { base: { sha: "base", ref: "release", repo: { full_name: "owner/repo" } } },
    { state: "closed" },
  ])("does not approve a changed PR snapshot %j", async (change) => {
    const { api, statuses, setPull } = fixture();
    const snapshot = await prepare(api);
    setPull(change);
    await finish(api, snapshot, "success", "");
    expect(statuses.at(-1)).toMatchObject({ sha: "head", state: "error" });
  });

  test("manual removal during classification cannot clear the block", async () => {
    const { api, statuses, setPull } = fixture(["sdk", "extensions"]);
    const snapshot = await prepare(api);
    setPull({ labels: [{ name: "extensions" }] });
    await finish(api, snapshot, "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).not.toBe("success");
  });

  test("reports errors when the current PR cannot be read", async () => {
    const { api, statuses } = fixture();
    const snapshot = await prepare(api);
    api.readPull = async () => {
      throw new Error("API unavailable");
    };
    await finish(api, snapshot, "success", "");
    expect(statuses.at(-1)?.state).toBe("error");
  });

  test("fails visibly when GitHub cannot return the complete diff", async () => {
    const { api, statuses, setPull } = fixture();
    setPull({ changed_files: 3001 });
    await expect(prepare(api)).rejects.toThrow();
    expect(statuses.at(-1)?.state).toBe("error");
  });
});

test("a silently skipped labeler cannot reuse an earlier passing status", async () => {
  const { api, statuses } = fixture();
  await finish(api, await prepare(api), "success", undefined);
  expect(statuses.at(-1)?.state).toBe("error");
});

test("label saturation during a run cannot hide a truncated area label", async () => {
  const { api, statuses, setPull } = fixture();
  const snapshot = await prepare(api);
  setPull({ labels: Array.from({ length: 100 }, (_, index) => ({ name: `manual-${index}` })) });
  await finish(api, snapshot, "success", "");
  expect(statuses.at(-1)?.state).toBe("error");
});
