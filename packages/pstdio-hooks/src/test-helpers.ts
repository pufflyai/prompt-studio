import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const createTempDir = async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "pstdio-hooks-test-")));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  return { dir, cleanup };
};
