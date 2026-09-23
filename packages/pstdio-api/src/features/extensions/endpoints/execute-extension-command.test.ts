import { expect, test } from "bun:test";
import { resolveCommandWorkspaceDir } from "./execute-extension-command";

test("uses the exact local workspace folder", () => {
  expect(resolveCommandWorkspaceDir({ root_path: "/repo/packages/app", execution_kind: "local" })).toBe(
    "/repo/packages/app",
  );
});
test("does not supply a local directory for a remote workspace", () => {
  expect(resolveCommandWorkspaceDir({ root_path: null, execution_kind: "remote" })).toBeUndefined();
});
