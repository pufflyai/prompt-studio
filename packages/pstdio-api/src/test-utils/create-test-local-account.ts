import { afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeAccount } from "../services/account/native-account";

const accounts = new Set<() => Promise<void>>();
// Let each fixture drain hooks and workers before its fallback authority retires.
afterAll(async () => {
  for (const close of [...accounts]) await close();
});

/** Real signed-out native authority for local-only command/runtime fixtures. */
export const createTestLocalAccount = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-local-account-fixture-"));
  const environmentId = crypto.randomUUID();
  const account = createNativeAccount({
    file: join(root, "native-account.json"),
    environment: { get: async () => ({ environmentId }) },
    projects: { get: async () => null },
  });
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= account.close().finally(() => {
      accounts.delete(close);
      rmSync(root, { recursive: true, force: true });
    }));
  accounts.add(close);
  return { ...account, close };
};
