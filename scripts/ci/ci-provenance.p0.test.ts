import { expect, test } from "bun:test";
import { requireMatchingProvenance } from "./ci-provenance";

test("a squash commit is accepted only when tested content and build inputs match", () => {
  const candidate = {
    sha: "a".repeat(40),
    tree: "b".repeat(40),
    bun: "1.4.4",
    node: "v24.19.0",
    platform: "linux",
    arch: "x64",
    inputsDigest: "c".repeat(64),
  };
  expect(() => requireMatchingProvenance({ ...candidate, sha: "d".repeat(40) }, candidate)).not.toThrow();
  for (const difference of [
    { tree: "e".repeat(40) },
    { bun: "1.4.3" },
    { node: "v24.19.1" },
    { platform: "darwin" },
    { arch: "arm64" },
    { inputsDigest: "f".repeat(64) },
  ]) {
    expect(() => requireMatchingProvenance({ ...candidate, ...difference }, candidate)).toThrow();
  }
});
