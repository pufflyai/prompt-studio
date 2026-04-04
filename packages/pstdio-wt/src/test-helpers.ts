import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "./git";

export const createTempRepo = async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "pstdio-wt-test-")));
  await git(dir, ["init", "-b", "main"]);
  await git(dir, ["config", "user.email", "test@test.com"]);
  await git(dir, ["config", "user.name", "Test"]);

  await Bun.write(join(dir, "README.md"), "# test repo\n");
  await git(dir, ["add", "."]);
  await git(dir, ["commit", "-m", "initial commit"]);

  const cleanup = () => rm(dir, { recursive: true, force: true });

  return { dir, cleanup };
};

export const waitFor = async (predicate: () => boolean, timeoutMs = 2_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return true;
    }

    await Bun.sleep(50);
  }

  return predicate();
};
