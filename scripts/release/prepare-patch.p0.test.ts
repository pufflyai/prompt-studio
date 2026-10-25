import { expect, test } from "bun:test";
import { planPatchCandidate } from "./prepare-patch";

const source = "a".repeat(40);
const input = {
  baseTag: "pstdio@0.43.1",
  currentStableTag: "pstdio@0.43.1",
  source,
  tagCommit: null as string | null,
  tagParent: null as string | null,
  releaseState: "missing" as "missing" | "draft" | "published",
};

test("reserves exactly the next patch of the current stable release", () => {
  expect(planPatchCandidate(input)).toEqual({ release: true, version: "0.43.2", tag: "pstdio@0.43.2", reuse: false });
});

test("resumes an existing patch only from the same fix commit", () => {
  expect(
    planPatchCandidate({ ...input, tagCommit: "b".repeat(40), tagParent: source, releaseState: "draft" }),
  ).toMatchObject({ reuse: true });
  expect(() => planPatchCandidate({ ...input, tagCommit: "b".repeat(40), tagParent: "c".repeat(40) })).toThrow(
    "reserved",
  );
});

test("does nothing when the requested patch already shipped", () => {
  expect(planPatchCandidate({ ...input, currentStableTag: "pstdio@0.43.2", releaseState: "published" })).toEqual({
    release: false,
  });
});

test("stops an unfinished patch when stable has advanced", () => {
  expect(() => planPatchCandidate({ ...input, currentStableTag: "pstdio@0.44.0" })).toThrow("current stable");
});
