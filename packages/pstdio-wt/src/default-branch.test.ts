import { describe, expect, test } from "bun:test";
import { getDefaultBranch } from "./default-branch";

describe("getDefaultBranch", () => {
  test("returns a branch name", async () => {
    const root = await findRepoRoot();
    const branch = await getDefaultBranch(root);
    expect(typeof branch).toBe("string");
    expect(branch.length).toBeGreaterThan(0);
  });
});

async function findRepoRoot() {
  const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], {
    cwd: import.meta.dir,
    stdout: "pipe",
  });
  return (await new Response(proc.stdout).text()).trim();
}
