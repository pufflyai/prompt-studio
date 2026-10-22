import { describe, expect, test } from "bun:test";
import { parseMainLog, parseReleaseTags } from "./commits";

const line = (...fields: string[]) => fields.join("\u001f");

describe("commit options", () => {
  test("names main commits by their distance from main", () => {
    const text = [line("65d36f4", "feat(PS-871): enable Cloud"), line("3d7f576", "fix(PS-788): save settings"), ""].join(
      "\n",
    );
    expect(parseMainLog(text)).toEqual([
      { sha: "65d36f4", ref: "main", message: "feat(PS-871): enable Cloud" },
      { sha: "3d7f576", ref: "main~1", message: "fix(PS-788): save settings" },
    ]);
  });

  test("keeps stable release tags and uses the commit an annotated tag points at", () => {
    const text = [
      line("pstdio@0.45.0", "", "3ad9c7c", "Version Packages (#1223)"),
      line("pstdio@0.45.1-nightly.20261022104952", "", "aaaaaaa", "Nightly"),
      line("pstdio@0.44.0", "d89331b", "tagobject", "Version Packages (#1078)"),
    ].join("\n");
    expect(parseReleaseTags(text)).toEqual([
      { sha: "3ad9c7c", ref: "pstdio@0.45.0", message: "Version Packages (#1223)" },
      { sha: "d89331b", ref: "pstdio@0.44.0", message: "Version Packages (#1078)" },
    ]);
  });
});
