import { expect, test } from "bun:test";
import { branchTemplate } from "./branch-templates";

test("a branch template pins the base and snapshot without changing runtime policy", () => {
  const base = {
    apiVersion: "pocketcoder.dev/v1",
    kind: "Template",
    metadata: { name: "remote-tests", description: "Run tests" },
    spec: { version: "1.0.0-base", image: "runtime@sha256:pin", network: { mode: "restricted" } },
  } as const;
  const source = { sha256: "a".repeat(64), revision: "d".repeat(40) };
  const first = branchTemplate(base, source);
  expect(first.metadata.name).toBe("remote-tests-branch");
  expect(first.metadata.description).toContain(source.revision.slice(0, 12));
  expect(first.spec).toMatchObject({ image: base.spec.image, network: base.spec.network });
  expect(first.spec.version).toMatch(/^1\.0\.0-branch-[a-f0-9]{24}$/);
  const packed = { ...source, archive: new Blob(["worktree snapshot"]), files: 3 };
  expect(branchTemplate(base, packed)).toEqual(first);
  expect(branchTemplate(base, { ...source, sha256: "b".repeat(64) }).spec.version).not.toBe(first.spec.version);
});
