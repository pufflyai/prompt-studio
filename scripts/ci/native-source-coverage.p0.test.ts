import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { nativeSourceGroups, selectWindowsSourceContracts } from "./native-source-coverage";
import { discoverTestFiles } from "./test-discovery";

test("focused Windows groups retain actual shell, PTY, ACL and database locking contracts", () => {
  const files = discoverTestFiles(resolve(import.meta.dir, "../.."));
  const process = selectWindowsSourceContracts(files, nativeSourceGroups[0]);
  const storage = selectWindowsSourceContracts(files, nativeSourceGroups[1]);
  expect(process).toContain("packages/pstdio-api/src/features/extensions/process-command.windows.exclusive.p1.test.ts");
  expect(process).toContain("packages/pstdio-api/src/features/extensions/windows-process-tree.p1.test.ts");
  expect(process).toContain("clients/desktop/src/performance/performance-endpoint.p0.test.ts");
  expect(process).toContain("packages/pstdio/src/features/terminal-interrupt.p0.test.ts");
  expect(storage).toContain("packages/pstdio-db/src/db/pglite-lock.p1.test.ts");
  expect(storage).toContain("packages/pstdio-db/src/db/pglite-lock-upgrade.p1.test.ts");
  expect(storage).toContain("packages/pstdio-db/src/db/rename-pglite-home.p1.test.ts");
  expect([...process, ...storage].some((file) => /planner.*order/.test(file))).toBe(false);
});
