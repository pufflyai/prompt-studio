import { describe, expect, test } from "bun:test";
import { finish, type PullRequest, prepare, type Status } from "./pr-risk-labels";

function fixture(labels: string[] = []) {
  let pull: PullRequest = {
    state: "open",
    head: { sha: "head" },
    base: { sha: "base", ref: "main" },
    changed_files: 2,
    labels: labels.map((name) => ({ name })),
  };
  const statuses: Array<{ sha: string } & Status> = [];
  const api = {
    async readPull() {
      return structuredClone(pull);
    },
    async publish(sha: string, status: Status) {
      statuses.push({ sha, ...status });
    },
  };
  return {
    api,
    statuses,
    setPull: (next: Partial<PullRequest>) => {
      pull = { ...pull, ...next };
    },
  };
}

describe("SDK and extension separation", () => {
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
    { head: { sha: "new-head" } },
    { base: { sha: "new-base", ref: "main" } },
    { base: { sha: "base", ref: "release" } },
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
