import { describe, expect, test } from "bun:test";
import { finish, type PullRequest, type PullRequestFile, prepare, type Status } from "./pr-risk-labels";

function fixture(labels: string[] = []) {
  let pull: PullRequest & { merged: boolean } = {
    state: "open",
    merged: false,
    user: { login: "contributor" },
    head: { sha: "head", ref: "feature/example", repo: { full_name: "owner/repo" } },
    base: { sha: "base", ref: "main", repo: { full_name: "owner/repo" } },
    changed_files: 2,
    labels: labels.map((name) => ({ name })),
  };
  const statuses: Array<{ sha: string } & Status> = [];
  let files: PullRequestFile[] = [
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
    setPull: (next: Partial<typeof pull>) => {
      pull = { ...pull, ...next };
    },
  };
}

async function prepareOpen(api: Parameters<typeof prepare>[0]) {
  const snapshot = await prepare(api);
  if (!snapshot) throw new Error("Expected an open pull request");
  return snapshot;
}

describe("generated Canvas catalog refreshes", () => {
  test("keeps extension source moved outside the extension directory separate", async () => {
    const { api, statuses, setFiles, setPull } = fixture(["sdk", "extensions"]);
    setFiles([
      { filename: "packages/sdk/src/client/projects.ts", status: "modified" },
      { filename: "extensions/canvas/src/catalog/generated/frame-bundle.ts", status: "modified" },
      { filename: "moved-package.json", status: "renamed", previous_filename: "extensions/canvas/package.json" },
    ]);
    setPull({ changed_files: 3 });
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("failure");
  });

  test("allows SDK changes with a refresh of the generated Canvas catalog", async () => {
    const { api, statuses, setFiles, setPull } = fixture(["sdk", "extensions"]);
    const generated = [
      "frame-bundle.ts",
      "frame-themes.json",
      "migration-ledger.json",
      "source-information.json",
      "stories.json",
    ];
    setFiles([
      { filename: "packages/sdk/src/client/projects.ts", status: "modified" },
      ...generated.map((name) => ({
        filename: `extensions/canvas/src/catalog/generated/${name}`,
        status: "modified",
      })),
    ]);
    setPull({ changed_files: generated.length + 1 });
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("success");
  });

  test.each([
    ["extensions/canvas/src/canvases/previews.tsx", "modified"],
    ["extensions/canvas/scripts/build-native-previews.ts", "modified"],
    ["extensions/canvas/src/catalog/generated/custom.ts", "modified"],
    ["extensions/example/extension.ts", "modified"],
    ["extensions/canvas/src/catalog/generated/frame-bundle.ts", "added"],
    ["extensions/canvas/src/catalog/generated/frame-bundle.ts", "removed"],
    ["extensions/canvas/src/catalog/generated/frame-bundle.ts", "renamed"],
  ])("keeps authored extension changes separate from SDK changes: %s (%s)", async (filename, status) => {
    const { api, statuses, setFiles, setPull } = fixture(["sdk", "extensions"]);
    setFiles([
      { filename: "packages/sdk/src/client/projects.ts", status: "modified" },
      { filename: "extensions/canvas/src/catalog/generated/stories.json", status: "modified" },
      { filename, status },
    ]);
    setPull({ changed_files: 3 });
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("failure");
  });

  test("cannot allow a generated catalog refresh from an incomplete diff", async () => {
    const { api, statuses, setFiles, setPull } = fixture(["sdk", "extensions"]);
    setFiles([{ filename: "extensions/canvas/src/catalog/generated/frame-bundle.ts", status: "modified" }]);
    setPull({ changed_files: 2 });
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("error");
  });
});

describe("SDK and extension separation", () => {
  test("closed merged pull requests preserve the existing commit verdict", async () => {
    const { api, statuses, setPull } = fixture(["sdk", "extensions"]);
    await api.publish("head", { state: "error", description: "Previous classification error" });
    setPull({ state: "closed", merged: true });
    expect(await prepare(api)).toBeUndefined();
    expect(statuses.map(({ sha, state }) => [sha, state])).toEqual([["head", "error"]]);
  });

  test("a closed pull request cannot overwrite an open pull request verdict on the same commit", async () => {
    const open = fixture(["sdk", "extensions"]);
    const closed = fixture();
    closed.setPull({ state: "closed", merged: true });
    closed.api.publish = open.api.publish;
    await finish(open.api, await prepareOpen(open.api), "success", "sdk,extensions");
    expect(open.statuses.at(-1)?.state).toBe("failure");
    expect(await prepare(closed.api)).toBeUndefined();
    expect(open.statuses.map(({ state }) => state)).toEqual(["pending", "failure"]);
  });

  test("closed unmerged pull requests keep their existing area verdict", async () => {
    const { api, statuses, setPull } = fixture(["sdk", "extensions"]);
    await api.publish("head", { state: "failure", description: "Mixed SDK and extension changes" });
    setPull({ state: "closed" });
    expect(await prepare(api)).toBeUndefined();
    expect(statuses.map(({ sha, state }) => [sha, state])).toEqual([["head", "failure"]]);
  });

  test("reopened pull requests require fresh area classification", async () => {
    const { api, statuses, setPull } = fixture(["sdk", "extensions"]);
    setPull({ state: "closed" });
    await prepare(api);
    setPull({ state: "open" });
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
    expect(statuses.slice(-2).map(({ state }) => state)).toEqual(["pending", "failure"]);
  });

  test("allows the fixed release group to update SDK and extension versions together", async () => {
    const { api, statuses, release } = fixture(["sdk", "extensions"]);
    release();
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
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
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
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
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
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
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
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
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
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
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).toBe("failure");
  });

  test("cannot exempt an incomplete release diff", async () => {
    const { api, statuses, release, setPull } = fixture(["sdk", "extensions"]);
    release();
    setPull({ changed_files: 3 });
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
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
    await finish(api, await prepareOpen(api), "success", "sdk,extensions");
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
    const snapshot = await prepareOpen(api);
    await finish(api, snapshot, "success", labels.join(","));
    expect(statuses.map((status) => [status.sha, status.state])).toEqual([
      ["head", "pending"],
      ["head", state],
    ]);
  });

  test("uses the current classification after SDK changes are reverted", async () => {
    const { api, statuses, setPull } = fixture(["sdk", "extensions"]);
    const snapshot = await prepareOpen(api);
    setPull({ labels: [{ name: "extensions" }, { name: "needs-migration" }] });
    await finish(api, snapshot, "success", "extensions,needs-migration");
    expect(statuses.at(-1)?.state).toBe("success");
  });

  test.each(["failure", "cancelled", "skipped"])("never passes when classification is %s", async (outcome) => {
    const { api, statuses } = fixture();
    await finish(api, await prepareOpen(api), outcome, "");
    expect(statuses.at(-1)?.state).toBe("error");
  });

  test.each([
    { head: { sha: "new-head", ref: "feature/example", repo: { full_name: "owner/repo" } } },
    { base: { sha: "new-base", ref: "main", repo: { full_name: "owner/repo" } } },
    { base: { sha: "base", ref: "release", repo: { full_name: "owner/repo" } } },
    { state: "closed" },
  ])("does not approve a changed PR snapshot %j", async (change) => {
    const { api, statuses, setPull } = fixture();
    const snapshot = await prepareOpen(api);
    setPull(change);
    await finish(api, snapshot, "success", "");
    expect(statuses.at(-1)).toMatchObject({ sha: "head", state: "error" });
  });

  test("manual removal during classification cannot clear the block", async () => {
    const { api, statuses, setPull } = fixture(["sdk", "extensions"]);
    const snapshot = await prepareOpen(api);
    setPull({ labels: [{ name: "extensions" }] });
    await finish(api, snapshot, "success", "sdk,extensions");
    expect(statuses.at(-1)?.state).not.toBe("success");
  });

  test("reports errors when the current PR cannot be read", async () => {
    const { api, statuses } = fixture();
    const snapshot = await prepareOpen(api);
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
  await finish(api, await prepareOpen(api), "success", undefined);
  expect(statuses.at(-1)?.state).toBe("error");
});

test("label saturation during a run cannot hide a truncated area label", async () => {
  const { api, statuses, setPull } = fixture();
  const snapshot = await prepareOpen(api);
  setPull({ labels: Array.from({ length: 100 }, (_, index) => ({ name: `manual-${index}` })) });
  await finish(api, snapshot, "success", "");
  expect(statuses.at(-1)?.state).toBe("error");
});
